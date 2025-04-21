// Script to check and clear ports 3000 and 5173 if they're in use
import { exec } from 'child_process';

const portsToCheck = [3000, 5173];

// Function to check if a port is in use
function checkPort(port) {
  return new Promise((resolve, reject) => {
    exec(`lsof -i :${port}`, (error, stdout, stderr) => {
      if (error) {
        // Port is not in use (command returns error if no process found)
        console.log(`✅ Port ${port} is free`);
        resolve(false);
      } else if (stdout) {
        // Port is in use
        console.log(`⚠️ Port ${port} is in use`);
        resolve(true);
      } else {
        console.log(`✅ Port ${port} is free`);
        resolve(false);
      }
    });
  });
}

// Function to kill process on a specific port
function killProcess(port) {
  return new Promise((resolve, reject) => {
    exec(`kill -9 $(lsof -t -i:${port} -sTCP:LISTEN)`, (error, stdout, stderr) => {
      if (error) {
        console.log(`ℹ️ No process to kill on port ${port}`);
        resolve(false);
      } else {
        console.log(`✅ Process on port ${port} killed`);
        resolve(true);
      }
    });
  });
}

// Main function to check and clear ports
async function clearPorts() {
  console.log('Checking ports...');
  
  for (const port of portsToCheck) {
    const inUse = await checkPort(port);
    if (inUse) {
      await killProcess(port);
    }
  }
  
  console.log('Port check complete. Ready to start servers.');
}

clearPorts().then(() => {
  console.log('Port clearing process completed.');
}); 