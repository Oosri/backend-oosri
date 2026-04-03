const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('https://api.haulam.com/api/v1/test/estimate', {
      originAddress: '3 Close B, Unity Estate Off Alkat way, Iju-Ishaga, Lagos, 100216, Nigeria',
      destinationAddress: '123 Main St, New York, NY, 10001, USA',
      packages: [{ weight: 1, length: 10, width: 10, height: 10 }]
    }, {
      headers: { Authorization: 'Bearer haulam_test_41ee153c19f5ad0ee91e084b47c9dd763cb107fad17b5bba' }
    });
    console.log("Success:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}
test();
