const { addEmailJob, emailQueue } = require('../src/queues/email.queue');
const { Worker } = require('bullmq');
const redis = require('../src/configs/redis');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function testDefaultVsPriority() {
    console.log('Clearing queue...');
    await emailQueue.pause();
    await emailQueue.drain();

    console.log('Adding jobs: Default vs Priority 1...');
    // Add default first (FIFO would process it first).
    // If Priority 1 is HIGHER than Default, it should jump ahead.

    await addEmailJob('test-job', { name: 'Job A (Default)', order: 1 });
    await addEmailJob('test-job', { name: 'Job B (Prio 1)', order: 2 }, { priority: 1 });

    console.log('Starting worker...');
    const processed = [];
    const worker = new Worker('email-queue', async job => {
        console.log(`Processing ${job.data.name} (Priority: ${job.opts.priority})`);
        processed.push(job.data.name);
    }, { connection: redis });

    console.log('Resuming queue to start processing...');
    await emailQueue.resume();

    let retries = 0;
    while (processed.length < 2 && retries < 10) {
        await delay(500);
        retries++;
    }

    console.log('Processing order:', processed);

    if (processed[0].includes('Prio 1')) {
        console.log('SUCCESS: Priority 1 > Default.');
    } else {
        console.log('WARNING: Default > Priority 1 (or FIFO applied).');
        // If Default > Priority 1, it means 0 (if default is 0) is higher priority than 1.
        // Or if Default has NO priority, maybe it's treated differently.
    }

    await worker.close();
    process.exit(0);
}

testDefaultVsPriority().catch(console.error);
