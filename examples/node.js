const SerialPort = require("serialport").SerialPort;

const port = new SerialPort({ path: '/dev/ttyUSB0', baudRate: 115200 });

