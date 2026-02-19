
const BASE_URL = 'http://localhost:4000/api';

async function runTests() {
    console.log('Starting Integration Tests...\n');
    let token = '';
    let clientId = '';
    let assessmentId = '';

    // --- SECURITY TESTS ---
    console.log('--- SECURITY TESTS ---');

    // SEC-01: Unauth access to clients
    try {
        const res = await fetch(`${BASE_URL}/clients`);
        if (res.status === 401) console.log('✅ SEC-01: Unauth clients blocked (401)');
        else console.error(`❌ SEC-01 Failed: expected 401, got ${res.status}`);
    } catch (e) { console.error('❌ SEC-01 Error:', e.message); }

    // SEC-02: Unauth access to dashboard
    try {
        const res = await fetch(`${BASE_URL}/dashboard/stats`);
        if (res.status === 401) console.log('✅ SEC-02: Unauth dashboard blocked (401)');
        else console.error(`❌ SEC-02 Failed: expected 401, got ${res.status}`);
    } catch (e) { console.error('❌ SEC-02 Error:', e.message); }

    // --- INTEGRITY TESTS ---
    console.log('\n--- INTEGRITY TESTS ---');

    // INT-01: Login
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@aigovernance.com', password: 'admin123' })
        });

        if (res.ok) {
            const data = await res.json();
            token = data.token;
            if (token) console.log('✅ INT-01: Login successful, token received');
            else console.error('❌ INT-01 Failed: No token in response');
        } else {
            console.error(`❌ INT-01 Failed: Login status ${res.status}`);
        }
    } catch (e) { console.error('❌ INT-01 Error:', e.message); }

    if (!token) {
        console.error('⛔ Stopping tests: No valid token.');
        return;
    }

    // --- FUNCTIONALITY TESTS ---
    console.log('\n--- FUNCTIONALITY TESTS ---');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // FUNC-01: Create Client
    try {
        const res = await fetch(`${BASE_URL}/clients`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: `Test Client ${Date.now()}`,
                industry: 'Technology',
                contactEmail: 'test@example.com',
                contactName: 'Test Contact'
            })
        });

        if (res.ok) {
            const data = await res.json();
            clientId = data.id;
            console.log('✅ FUNC-01: Client created successfully');
        } else {
            console.error(`❌ FUNC-01 Failed: Status ${res.status}`);
        }
    } catch (e) { console.error('❌ FUNC-01 Error:', e.message); }

    // FUNC-02: Create Assessment
    if (clientId) {
        try {
            const res = await fetch(`${BASE_URL}/assessments`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    clientId: clientId,
                    type: 'EXPRESS'
                })
            });

            if (res.ok) {
                const data = await res.json();
                assessmentId = data.assessment.id;
                console.log('✅ FUNC-02: Assessment created successfully');
            } else {
                console.error(`❌ FUNC-02 Failed: Status ${res.status}`);
            }
        } catch (e) { console.error('❌ FUNC-02 Error:', e.message); }
    }

    // FUNC-03: Dashboard Stats
    try {
        const res = await fetch(`${BASE_URL}/dashboard/stats`, { headers });
        if (res.ok) console.log('✅ FUNC-03: Auth dashboard access successful');
        else console.error(`❌ FUNC-03 Failed: Status ${res.status}`);
    } catch (e) { console.error('❌ FUNC-03 Error:', e.message); }

}

runTests();
