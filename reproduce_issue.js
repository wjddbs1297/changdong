
const url = 'https://script.google.com/macros/s/AKfycbyos-gVkzXK5ClNga1abI2O9jSR9d8NY5mRSPipNvzd4CpmkAJm5dxh7tQTnmfnJc5JCA/exec';
const TEST_USER = 'TestLimitUser_' + Date.now();
const TEST_DATE = '2026-11-20';

async function run() {
    console.log(`Testing with User: ${TEST_USER}`);

    // 1. Book 3 Hours (10:00 - 13:00)
    console.log("1. Attempting 3-hour booking...");
    const res1 = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            method: 'CREATE',
            userId: TEST_USER,
            roomId: 'TEST_ROOM_A',
            date: TEST_DATE,
            startTime: '10:00',
            duration: '3'
        })
    });
    const json1 = await res1.json();
    console.log("Booking 1 Result:", json1);

    if (json1.status !== 'success') {
        console.error("Setup failed. Could not create initial booking.");
        return;
    }

    // 2. Book 1 Hour (14:00 - 15:00) - Should Fail
    console.log("\n2. Attempting additional 1-hour booking...");
    const res2 = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({
            method: 'CREATE',
            userId: TEST_USER,
            roomId: 'TEST_ROOM_B',
            date: TEST_DATE,
            startTime: '14:00',
            duration: '1'
        })
    });
    const json2 = await res2.json();
    console.log("BOOOKING 2 DEBUG INFO:");
    console.log(JSON.stringify(json2.debug_check, null, 2));

    if (json2.status === 'error' && json2.message.includes('하루 최대 3시간')) {
        console.log("\nSUCCESS: Limit enforced. Second booking rejected.");
    } else {
        console.log("\nFAILURE: Limit bypassed. Second booking accepted.");
    }

    // Cleanup (Cancel bookings - verification purpose only, assuming we have IDs)
    // ... skipping cleanup for now to keep history visible in sheet if needed, or we can assume manual cleanup.
}

run();
