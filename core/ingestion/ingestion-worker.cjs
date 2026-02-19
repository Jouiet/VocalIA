/**
 * Ingestion Worker - Isolated Browser Process
 * 
 * Role: Execute heavy web scraping tasks in a separate process.
 * Safety: If Chrome crashes, this process dies, but the Main Server survives.
 * Communication: IPC (Parent <-> Child)
 */

const KnowledgeIngestion = require('./KnowledgeIngestion.cjs');
let ingestor = null;

// Graceful Shutdown
process.on('SIGTERM', async () => {
    if (ingestor) await ingestor.close();
    process.exit(0);
});

async function main() {
    try {
        ingestor = new KnowledgeIngestion();
        await ingestor.init();

        // Notify parent we are ready
        if (process.send) process.send({ type: 'READY' });

        // Listen for tasks
        process.on('message', async (msg) => {
            if (msg.type === 'SCRAPE') {
                const { url, id } = msg.payload;
                try {
                    const result = await ingestor.scrape(url);
                    if (process.send) {
                        process.send({
                            type: 'SCRAPE_SUCCESS',
                            requestId: id,
                            data: result
                        });
                    }
                } catch (err) {
                    if (process.send) {
                        process.send({
                            type: 'SCRAPE_ERROR',
                            requestId: id,
                            error: err.message
                        });
                    }
                }
            } else if (msg.type === 'SHUTDOWN') {
                await ingestor.close();
                process.exit(0);
            }
        });

    } catch (err) {
        console.error('[IngestionWorker] Fatal Init Error:', err);
        process.exit(1);
    }
}

main();
