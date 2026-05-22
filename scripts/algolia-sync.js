/**
 * Backfills all existing products into the Algolia index and configures
 * the index settings (filterable + searchable attributes).
 *
 *   node scripts/algolia-sync.js
 */

require('dotenv').config();
const algoliasearch = require('algoliasearch');
const dbConnect = require('../src/configs/database');
const buyerProductService = require('../src/Buyer/Service/buyerProductService');

const writeClient = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_WRITE_API_KEY
);
const index = writeClient.initIndex(process.env.ALGOLIA_INDEX_NAME);

(async () => {
  try {
    console.log('Connecting to MongoDB...');
    await dbConnect();

    console.log('Configuring Algolia index settings...');
    await index.setSettings({
      searchableAttributes: [
        'productName',
        'productDescription',
        'brandName',
        'artist',
        'category',
        'country',
        'condition',
      ],
      attributesForFaceting: [
        'filterOnly(isVisible)',
        'filterOnly(isApproved)',
        'category',
        'seller',
      ],
      customRanking: ['desc(createdAt)'],
    });
    console.log('Index settings configured.');

    console.log('Starting full Algolia sync...');
    await buyerProductService.syncProductsToAlgolia();

    console.log('Done. Check your Algolia dashboard to confirm records.');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
})();
