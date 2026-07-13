from flask import Flask, render_template, request, jsonify
import mysql.connector
from mysql.connector import Error
from datetime import datetime
import math, re
import config

app = Flask(__name__)
app.config['SECRET_KEY'] = config.SECRET_KEY
RATES = {'Car': 50, 'Bike': 20}

def server_connection(database=None):
    args = dict(host=config.MYSQL_HOST, port=config.MYSQL_PORT, user=config.MYSQL_USER, password=config.MYSQL_PASSWORD)
    if database: args['database'] = database
    return mysql.connector.connect(**args)

def db(): return server_connection(config.MYSQL_DATABASE)

def initialize_database():
    conn = server_connection(); cur = conn.cursor()
    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{config.MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    cur.close(); conn.close()
    conn = db(); cur = conn.cursor()
    cur.execute("""CREATE TABLE IF NOT EXISTS parking_slots (id INT AUTO_INCREMENT PRIMARY KEY, slot_number VARCHAR(10) NOT NULL UNIQUE, vehicle_type ENUM('Car','Bike') NOT NULL, status ENUM('Available','Occupied') NOT NULL DEFAULT 'Available', vehicle_number VARCHAR(20) NULL)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS vehicles (id INT AUTO_INCREMENT PRIMARY KEY, vehicle_number VARCHAR(20) NOT NULL UNIQUE, vehicle_type ENUM('Car','Bike') NOT NULL, mobile VARCHAR(10) NOT NULL, slot_number VARCHAR(10) NOT NULL UNIQUE, entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS valet_queue (id INT AUTO_INCREMENT PRIMARY KEY, vehicle_number VARCHAR(20) NOT NULL UNIQUE, vehicle_type ENUM('Car','Bike') NOT NULL, mobile VARCHAR(10) NOT NULL, entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)""")
    cur.execute("""CREATE TABLE IF NOT EXISTS parking_history (id INT AUTO_INCREMENT PRIMARY KEY, vehicle_number VARCHAR(20) NOT NULL, vehicle_type ENUM('Car','Bike') NOT NULL, mobile VARCHAR(10) NOT NULL, slot_number VARCHAR(10) NOT NULL, entry_time DATETIME NOT NULL, exit_time DATETIME NOT NULL, duration_minutes INT NOT NULL, billed_hours DECIMAL(5,2) NOT NULL, charge DECIMAL(10,2) NOT NULL)""")
    try:
        cur.execute("ALTER TABLE parking_history MODIFY billed_hours DECIMAL(5,2) NOT NULL")
    except Exception:
        pass
    for t,p in [('Car','C'),('Bike','B')]:
        for i in range(1,7): cur.execute("INSERT IGNORE INTO parking_slots(slot_number,vehicle_type) VALUES(%s,%s)",(f'{p}{i:02d}',t))
    conn.commit(); cur.close(); conn.close()

def normalize(v): return re.sub(r'\s+',' ',(v or '').strip().upper())
def dt(v): return v.isoformat() if v else None

@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/state', methods=['GET'])
def state():
    conn = db()
    cur = conn.cursor(dictionary=True)

    try:
        # ==============================
        # CURRENTLY PARKED VEHICLES
        # ==============================

        cur.execute("""
            SELECT
                vehicle_number,
                vehicle_type,
                mobile,
                slot_number,
                entry_time
            FROM vehicles
            ORDER BY entry_time
        """)

        parked_rows = cur.fetchall()

        parked = []

        for row in parked_rows:
            parked.append({
                "vehicleNo": row["vehicle_number"],
                "type": row["vehicle_type"],
                "mobile": row["mobile"],
                "slot": row["slot_number"],
                "entry": dt(row["entry_time"])
            })


        # ==============================
        # VALET WAITING QUEUE
        # ==============================

        cur.execute("""
            SELECT
                vehicle_number,
                vehicle_type,
                mobile,
                entry_time
            FROM valet_queue
            ORDER BY entry_time
        """)

        queue_rows = cur.fetchall()

        queue = []

        for row in queue_rows:
            queue.append({
                "vehicleNo": row["vehicle_number"],
                "type": row["vehicle_type"],
                "mobile": row["mobile"],
                "entry": dt(row["entry_time"])
            })


        # ==============================
        # PARKING HISTORY
        # ==============================

        cur.execute("""
            SELECT
                vehicle_number,
                vehicle_type,
                mobile,
                slot_number,
                entry_time,
                exit_time,
                duration_minutes,
                billed_hours,
                charge
            FROM parking_history
            ORDER BY exit_time
        """)

        history_rows = cur.fetchall()

        history = []

        for row in history_rows:
            history.append({
                "vehicleNo": row["vehicle_number"],
                "type": row["vehicle_type"],
                "mobile": row["mobile"],
                "slot": row["slot_number"],
                "entry": dt(row["entry_time"]),
                "exit": dt(row["exit_time"]),
                "minutes": row["duration_minutes"],
                "hours": row["billed_hours"],
                "charge": float(row["charge"] or 0)
            })


        # ==============================
        # TOTAL REVENUE
        # ==============================

        cur.execute("""
            SELECT COALESCE(SUM(charge), 0) AS total_revenue
            FROM parking_history
        """)

        revenue_row = cur.fetchone()

        revenue = float(
            revenue_row["total_revenue"] or 0
        )


        # ==============================
        # SEND DATA TO FRONTEND
        # ==============================

        return jsonify({
            "parked": parked,
            "queue": queue,
            "history": history,
            "revenue": revenue
        })


    except Exception as e:

        print("STATE API ERROR:", e)

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500


    finally:
        cur.close()
        conn.close()
@app.post('/api/vehicle-entry')
def vehicle_entry():
    body=request.get_json(silent=True) or {}; no=normalize(body.get('vehicleNo')); typ=body.get('type'); mobile=(body.get('mobile') or '').strip()
    if not no or typ not in RATES or not re.fullmatch(r'\d{10}',mobile): return jsonify(success=False,message='Enter a valid vehicle number, type and 10-digit mobile number.'),400
    conn=db(); cur=conn.cursor(dictionary=True)
    try:
        conn.start_transaction()
        cur.execute('SELECT vehicle_number FROM vehicles WHERE vehicle_number=%s UNION SELECT vehicle_number FROM valet_queue WHERE vehicle_number=%s',(no,no))
        if cur.fetchone(): conn.rollback(); return jsonify(success=False,message='Vehicle already exists in the system.'),409
        cur.execute("SELECT slot_number FROM parking_slots WHERE vehicle_type=%s AND status='Available' ORDER BY slot_number LIMIT 1 FOR UPDATE",(typ,)); slot=cur.fetchone()
        if slot:
            sn=slot['slot_number']; cur.execute('INSERT INTO vehicles(vehicle_number,vehicle_type,mobile,slot_number) VALUES(%s,%s,%s,%s)',(no,typ,mobile,sn)); cur.execute("UPDATE parking_slots SET status='Occupied',vehicle_number=%s WHERE slot_number=%s",(no,sn)); result={'queued':False,'slot':sn}
        else:
            cur.execute('INSERT INTO valet_queue(vehicle_number,vehicle_type,mobile) VALUES(%s,%s,%s)',(no,typ,mobile)); result={'queued':True,'position':cur.lastrowid}
        conn.commit(); return jsonify(success=True,vehicleNo=no,**result)
    except Exception as e: conn.rollback(); return jsonify(success=False,message=str(e)),500
    finally: cur.close(); conn.close()

@app.post('/api/vehicle-lookup')
def vehicle_lookup():
    no=normalize((request.get_json(silent=True) or {}).get('vehicleNo')); conn=db(); cur=conn.cursor(dictionary=True); cur.execute('SELECT vehicle_number,vehicle_type,mobile,slot_number,entry_time FROM vehicles WHERE vehicle_number=%s',(no,)); v=cur.fetchone(); cur.close(); conn.close()
    if not v: return jsonify(success=False,message='Vehicle not found in parked vehicles.'),404
    mins=max(1,math.ceil((datetime.now()-v['entry_time']).total_seconds()/60))
    hours=round(mins/60,2)
    charge=round((mins * RATES[v['vehicle_type']]) / 60, 2)
    return jsonify(success=True,vehicle={'vehicleNo':v['vehicle_number'],'type':v['vehicle_type'],'slot':v['slot_number'],'entry':dt(v['entry_time']),'minutes':mins,'hours':hours,'rate':RATES[v['vehicle_type']],'charge':charge})

@app.post('/api/vehicle-exit')
def vehicle_exit():
    no=normalize((request.get_json(silent=True) or {}).get('vehicleNo')); conn=db(); cur=conn.cursor(dictionary=True)
    try:
        conn.start_transaction(); cur.execute('SELECT * FROM vehicles WHERE vehicle_number=%s FOR UPDATE',(no,)); v=cur.fetchone()
        if not v: conn.rollback(); return jsonify(success=False,message='Vehicle not found.'),404
        now=datetime.now(); mins=max(1,math.ceil((now-v['entry_time']).total_seconds()/60)); hours=round(mins/60,2); charge=round((mins * RATES[v['vehicle_type']]) / 60, 2); freed=v['slot_number']
        cur.execute('INSERT INTO parking_history(vehicle_number,vehicle_type,mobile,slot_number,entry_time,exit_time,duration_minutes,billed_hours,charge) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)',(v['vehicle_number'],v['vehicle_type'],v['mobile'],freed,v['entry_time'],now,mins,hours,charge))
        cur.execute('DELETE FROM vehicles WHERE id=%s',(v['id'],)); cur.execute("UPDATE parking_slots SET status='Available',vehicle_number=NULL WHERE slot_number=%s",(freed,))
        cur.execute('SELECT * FROM valet_queue WHERE vehicle_type=%s ORDER BY id LIMIT 1 FOR UPDATE',(v['vehicle_type'],)); nxt=cur.fetchone(); moved=None
        if nxt:
            cur.execute('INSERT INTO vehicles(vehicle_number,vehicle_type,mobile,slot_number,entry_time) VALUES(%s,%s,%s,%s,%s)',(nxt['vehicle_number'],nxt['vehicle_type'],nxt['mobile'],freed,nxt['entry_time'])); cur.execute('DELETE FROM valet_queue WHERE id=%s',(nxt['id'],)); cur.execute("UPDATE parking_slots SET status='Occupied',vehicle_number=%s WHERE slot_number=%s",(nxt['vehicle_number'],freed)); moved=nxt['vehicle_number']
        conn.commit(); return jsonify(success=True,freedSlot=freed,movedVehicle=moved,charge=charge)
    except Exception as e: conn.rollback(); return jsonify(success=False,message=str(e)),500
    finally: cur.close(); conn.close()

@app.get('/api/health')
def health():
    conn=db(); conn.close(); return jsonify(status='ok',database=config.MYSQL_DATABASE)

if __name__ == '__main__':
    try:
        initialize_database(); print(f'MySQL connected. Database: {config.MYSQL_DATABASE}')
        app.run(debug=True, use_reloader=False)
    except Error as e:
        print('\nDATABASE CONNECTION ERROR:', e)
        print('Check config.py: MySQL must be running and MYSQL_PASSWORD must be correct.')
