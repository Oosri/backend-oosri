const axios = require('axios');
async function test() {
  const serviceTypes = ['domestic', 'local', 'Local Delivery', 'expressDomestic', undefined];
  
  for (const st of serviceTypes) {
    console.log(`\nTesting serviceType: ${st}`);
    try {
      const payload = {
        originAddress: '3 Close B, Unity Estate Off Alkat way, Iju-Ishaga, Lagos, 100216, Nigeria',
        destinationAddress: '100 Allen Avenue, Ikeja, Lagos, Nigeria',
        packages: [{ weight: 1, length: 10, width: 10, height: 10 }]
      };
      if (st) payload.serviceType = st;

      const res = await axios.post('https://api.haulam.com/api/v1/test/estimate', payload, {
        headers: { Authorization: 'Bearer haulam_test_41ee153c19f5ad0ee91e084b47c9dd763cb107fad17b5bba' }
      });
      console.log("Success:", JSON.stringify(res.data, null, 2));
      return; // break if one succeeds
    } catch (err) {
      console.error("Error:", err.response?.data || err.message);
    }
  }
}
test();
