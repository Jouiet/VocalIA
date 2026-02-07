/**
 * CLEANUP UUID-STYLE TENANTS
 * Remove tenants created with auto-generated UUIDs and re-seed with proper IDs
 */

const path = require('path');
const fs = require('fs');
const { GoogleSheetsDB } = require(path.join(__dirname, '..', 'core', 'GoogleSheetsDB.cjs'));

const CLIENTS_DIR = path.join(__dirname, '..', 'clients');

async function cleanup() {
    console.log('🧹 Cleaning up UUID-style tenants...\n');

    const db = new GoogleSheetsDB();
    await db.init();

    const tenants = await db.findAll('tenants');
    console.log(`Found ${tenants.length} total tenants\n`);

    // UUID pattern: 8 hex chars
    const uuidPattern = /^[0-9a-f]{8}$/;
    const toDelete = tenants.filter(t => uuidPattern.test(t.id));
    const toKeep = tenants.filter(t => !uuidPattern.test(t.id));

    console.log(`UUID-style tenants (to delete): ${toDelete.length}`);
    console.log(`Friendly-ID tenants (to keep): ${toKeep.length}`);
    console.log('');

    if (toDelete.length === 0) {
        console.log('Nothing to clean up.');
        return;
    }

    // Delete from database
    let dbDeleted = 0;
    for (const tenant of toDelete) {
        try {
            await db.delete('tenants', tenant.id);
            dbDeleted++;
            if (dbDeleted % 50 === 0) {
                console.log(`Deleted ${dbDeleted}/${toDelete.length} from DB...`);
            }
            await new Promise(r => setTimeout(r, 50)); // Rate limit
        } catch (err) {
            console.error(`Failed to delete ${tenant.id}: ${err.message}`);
        }
    }
    console.log(`✅ Deleted ${dbDeleted} tenants from database`);

    // Delete KB directories
    let dirsDeleted = 0;
    for (const tenant of toDelete) {
        const dir = path.join(CLIENTS_DIR, tenant.id);
        if (fs.existsSync(dir)) {
            try {
                fs.rmSync(dir, { recursive: true });
                dirsDeleted++;
            } catch (err) {
                console.error(`Failed to delete dir ${tenant.id}: ${err.message}`);
            }
        }
    }
    console.log(`✅ Deleted ${dirsDeleted} KB directories`);

    console.log('\n' + '═'.repeat(50));
    console.log('📊 CLEANUP COMPLETE');
    console.log(`DB records deleted: ${dbDeleted}`);
    console.log(`KB directories deleted: ${dirsDeleted}`);
    console.log('═'.repeat(50));
    console.log('\n🔄 Next: Run seed-500-tenants.cjs to recreate with proper IDs');
}

cleanup().catch(console.error);
