const humanQueries = require('./queries/human');
const flyQueries   = require('./queries/fly');

const SPECIES_MAP = { human: humanQueries, fly: flyQueries };
const species = (process.env.SPECIES || 'all').toLowerCase();

const ALL_QUERIES = species === 'all'
    ? [...humanQueries, ...flyQueries]
    : (() => {
        const pool = SPECIES_MAP[species];
        if (!pool) throw new Error(`Unknown SPECIES "${species}". Valid values: ${Object.keys(SPECIES_MAP).join(', ')}, all`);
        return pool;
    })();

let queryIndex = 0;

module.exports = {
    generatePayload,
    waitForCompletion
};

function generatePayload(context, events, done) {
    const selected = ALL_QUERIES[queryIndex % ALL_QUERIES.length]();
    queryIndex++;

    context.vars.payload   = selected.payload;
    context.vars.queryName = selected.name;
    context.vars.startTime = Date.now();

    return done();
}

/**
 * Listens for Socket.IO completion events and records per-query latency.
 */
function waitForCompletion(context, events, done) {
    let socket = context.sockets[""];

    if (!socket && context.sockets) {
        const socketKeys = Object.keys(context.sockets);
        if (socketKeys.length > 0) {
            socket = context.sockets[socketKeys[0]];
        }
    }

    if (!socket || !socket.on) {
        console.error("❌ ERROR: No active Socket.IO connection found in context.sockets");
        return done(new Error("No active socket connection"));
    }

    const timeoutHandle = setTimeout(() => {
        if (socket.off) {
            socket.off('socket_event', listener);
            socket.off('update', listener);
        }
        done(new Error('Timeout waiting for COMPLETE status'));
    }, Number(process.env.COMPLETION_TIMEOUT_MS) || 40 * 60 * 1000);

    const listener = (data) => {
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { }
        }

        if (data?.update?.graph === true) {
            clearTimeout(timeoutHandle);
            socket.off('socket_event', listener);
            socket.off('update', listener);

            const duration = Date.now() - context.vars.startTime;
            events.emit('histogram', `latency_${context.vars.queryName}`, duration);
            return done();
        }
        else if (data?.status === 'FAILED' || data?.status === 'CANCELLED') {
            clearTimeout(timeoutHandle);
            socket.off('socket_event', listener);
            socket.off('update', listener);
            return done(new Error(`Server returned ${data.status}`));
        }
    };

    socket.on('update', listener);
}
