const axios = require('axios');

const API_KEY =  "haulam_test_41ee153c19f5ad0ee91e084b47c9dd763cb107fad17b5bba";
const HAULAM_ESTIMATE_URL = 'https://api.haulam.com/api/v1/test/estimate';

/**
 * Fetch shipping estimate from Haulam test endpoint.
 * @param {Object} estimateBody - Request body for the estimate API (originAddress, destinationAddress, packages)
 * @returns {Promise<Object>} - Response body from Haulam API
 */
async function fetchShippingEstimate(estimateBody) {
	if (!estimateBody || typeof estimateBody !== 'object') {
		throw new Error('estimateBody (object) is required');
	}

	try {
		const resp = await axios.post(HAULAM_ESTIMATE_URL, estimateBody, {
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${API_KEY}`
			},
			timeout: 15000
		});

		return resp.data;
	} catch (err) {
		// Normalize error for callers
		if (err.response) {
			const e = new Error('Haulam API error');
			e.status = err.response.status;
			e.data = err.response.data;
			throw e;
		}
		throw err;
	}
}

module.exports = {
	API_KEY,
	fetchShippingEstimate,
	HAULAM_ESTIMATE_URL
};

// If run directly, execute a sample request for quick testing
if (require.main === module) {
	(async () => {
		const sampleBody = {
			originAddress: "100 Allen Avenue, Ikeja, Lagos, Nigeria",
			destinationAddress: "123 Main St, New York, NY, USA",
			packages: [
				{
					weight: 10,
					length: 12,
					width: 12,
					height: 12,
					description: "Box of clothes",
					value: 20000
				}
			]
		};

		console.log('Sending sample Haulam estimate request...');
		try {
			const res = await fetchShippingEstimate(sampleBody);
			console.log('Haulam estimate response:');
			console.dir(res, { depth: null });
			process.exit(0);
		} catch (err) {
			console.error('Haulam estimate failed:');
			if (err.status) console.error('Status:', err.status);
			if (err.data) console.error('Body:', err.data);
			console.error(err.message || err);
			process.exit(1);
		}
	})();
}
