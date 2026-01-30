import { calendarTools } from '../dist/tools/calendar.js';

async function testCalendar() {
    console.log("🧪 Testing Calendar MCP Tools...");

    // Test 1: Check Availability (Mock/No Creds)
    console.log("\n[Test 1] check_availability (Expect Error/Hint)");
    const result1 = await calendarTools.check_availability.handler({
        timeMin: "2026-01-30T09:00:00Z",
        timeMax: "2026-01-30T17:00:00Z"
    });
    console.log("Result:", result1.content[0].text);

    if (result1.content[0].text.includes("ERROR") || result1.content[0].text.includes("hint") || result1.content[0].text.includes("Missing")) {
        console.log("✅ PASS: Correctly handled missing credentials");
    } else {
        console.log("❓ Unexpected result (maybe creds exist?)");
    }

    // Test 2: Create Event (Mock/No Creds)
    console.log("\n[Test 2] create_event (Expect Error/Hint)");
    const result2 = await calendarTools.create_event.handler({
        summary: "Test Meeting",
        startTime: "2026-01-31T10:00:00Z",
        endTime: "2026-01-31T11:00:00Z"
    });
    console.log("Result:", result2.content[0].text);

    if (result2.content[0].text.includes("ERROR") || result2.content[0].text.includes("hint") || result2.content[0].text.includes("Missing")) {
        console.log("✅ PASS: Correctly handled missing credentials");
    } else {
        console.log("❓ Unexpected result");
    }
}

testCalendar().catch(console.error);
