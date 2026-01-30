import { slackTools } from '../dist/tools/slack.js';

async function testSlack() {
    console.log("🧪 Testing Slack MCP Tools...");

    // Test 1: Send Notification (Mock/No Websocket)
    console.log("\n[Test 1] send_notification (Expect Error/Hint)");
    const result1 = await slackTools.send_notification.handler({
        message: "Test Notification from VocalIA Audit",
        username: "VocalIA Bot"
    });
    console.log("Result:", result1.content[0].text);

    if (result1.content[0].text.includes("error") || result1.content[0].text.includes("Missing")) {
        console.log("✅ PASS: Correctly handled missing webhook URL");
    } else {
        console.log("❓ Unexpected result");
    }
}

testSlack().catch(console.error);
