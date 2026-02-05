
const { spawn } = require('child_process');
const path = require('path');

async function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        console.log(`\n--- Running ${scriptName} ---`);
        const start = Date.now();
        // Run from project root, pass script raw path
        const child = spawn('node', [`tests/${scriptName}`], {
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            const duration = Date.now() - start;
            if (code === 0) {
                console.log(`✅ ${scriptName} finished in ${duration}ms`);
                resolve(duration);
            } else {
                console.error(`❌ ${scriptName} failed with code ${code}`);
                reject(new Error(`${scriptName} failed`));
            }
        });
    });
}

async function runE2E() {
    console.log('🚀 Starting E2E Workflow Performance Test...');

    // Ensure setup
    try {
        await runScript('setup_test_data.js');
    } catch (e) {
        console.error('Setup failed, aborting.');
        return;
    }

    try {
        // Seller Journey
        console.log('\n📦 Seller Workflow (Upload)');
        const uploadTime = await runScript('manual_upload_test.js');

        // Buyer Journey (Search + Shipping + Payment)
        // We can run payment flow which does most of it, and perf_shipping for detail.
        // Or create a devoted script. Reuse is fine for now to save time/complexity.
        console.log('\n🛒 Buyer Workflow (Browse, Ship, Pay)');
        const shippingTime = await runScript('perf_shipping.js');
        const paymentTime = await runScript('manual_payment_flow.js');

        console.log('\n📊 === PERFORMANCE REPORT ===');
        console.log(`Seller Upload Flow: ${uploadTime}ms`);
        console.log(`Buyer Shipping Check: ${shippingTime}ms`);
        console.log(`Buyer Payment Flow: ${paymentTime}ms`);
        console.log(`TOTAL E2E Time (Sequential): ${uploadTime + shippingTime + paymentTime}ms`);

    } catch (err) {
        console.error('E2E Test Failed:', err.message);
    }
}

runE2E();
