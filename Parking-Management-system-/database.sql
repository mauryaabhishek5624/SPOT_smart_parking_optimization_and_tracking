CREATE DATABASE IF NOT EXISTS spot_parking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE spot_parking;

CREATE TABLE IF NOT EXISTS parking_slots (
 id INT AUTO_INCREMENT PRIMARY KEY,
 slot_number VARCHAR(10) NOT NULL UNIQUE,
 vehicle_type ENUM('Car','Bike') NOT NULL,
 status ENUM('Available','Occupied') NOT NULL DEFAULT 'Available',
 vehicle_number VARCHAR(20) NULL
);
CREATE TABLE IF NOT EXISTS vehicles (
 id INT AUTO_INCREMENT PRIMARY KEY,
 vehicle_number VARCHAR(20) NOT NULL UNIQUE,
 vehicle_type ENUM('Car','Bike') NOT NULL,
 mobile VARCHAR(10) NOT NULL,
 slot_number VARCHAR(10) NOT NULL UNIQUE,
 entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS valet_queue (
 id INT AUTO_INCREMENT PRIMARY KEY,
 vehicle_number VARCHAR(20) NOT NULL UNIQUE,
 vehicle_type ENUM('Car','Bike') NOT NULL,
 mobile VARCHAR(10) NOT NULL,
 entry_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS parking_history (
 id INT AUTO_INCREMENT PRIMARY KEY,
 vehicle_number VARCHAR(20) NOT NULL,
 vehicle_type ENUM('Car','Bike') NOT NULL,
 mobile VARCHAR(10) NOT NULL,
 slot_number VARCHAR(10) NOT NULL,
 entry_time DATETIME NOT NULL,
 exit_time DATETIME NOT NULL,
 duration_minutes INT NOT NULL,
 billed_hours INT NOT NULL,
 charge DECIMAL(10,2) NOT NULL
);
INSERT IGNORE INTO parking_slots(slot_number, vehicle_type) VALUES
('C01','Car'),('C02','Car'),('C03','Car'),('C04','Car'),('C05','Car'),('C06','Car'),
('B01','Bike'),('B02','Bike'),('B03','Bike'),('B04','Bike'),('B05','Bike'),('B06','Bike');
