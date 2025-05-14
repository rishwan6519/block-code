const dnssd = require('dnssd');
const express = require('express');
const cors = require('cors');

const app = express();
const port = 5001;

app.use(cors());

app.get('/find-bot', (req, res) => {
  console.log('🔍 /find-bot');
  const browser = new dnssd.Browser(dnssd.tcp('_CentoBot'));
  let responded = false; // Flag to check if we have received a response
 console.log(browser.on('serviceUp', service => {
    console.log(`Found service: ${service.name}`);
    console.log(`Host: ${service.host}`);
    console.log(`Port: ${service.port}`);
    console.log(`Addresses: ${service.addresses.join(', ')}`); // This includes IPs
  }
 
    
 ))


  browser.on('serviceUp', service => {
    if (!responded) { // Only respond once
      responded = true;
      console.log('Service found:', service);
      console.log(`Found service: ${service.name}`);
      console.log(`Host: ${service.host}`);
      console.log(`Port: ${service.port}`);
      console.log(`ip: ${service.addresses.join(', ')}`); // This includes IPs

      // Send response to client
      res.json({
        name: service.name,
        host: service.host,
        port: service.port,
        ip: service.addresses,
      });

      browser.stop(); // Stop searching after finding the first service
    }
  });

  browser.on('error', console.error);
  browser.start();

  // Timeout if no service is found within 5 seconds
  setTimeout(() => {
    if (!responded) {
      browser.stop();
      res.status(404).send({ error: 'No bot found' });
    }
  }, 5000);
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
