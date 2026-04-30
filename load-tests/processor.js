const humanQueries = require('./queries/human');
const flyQueries   = require('./queries/fly');
// To add a new species: create queries/<species>.js and spread it into ALL_QUERIES below

const ALL_QUERIES = [...humanQueries, ...flyQueries];

module.exports = {
    generatePayload,
    waitForCompletion
};

function generatePayload(context, events, done) {
    const selected = ALL_QUERIES[Math.floor(Math.random() * ALL_QUERIES.length)]();

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
    }, 40 * 60 * 1000);

    const listener = (data) => {
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { }
        }

        if (data.update.graph === true) {
            clearTimeout(timeoutHandle);
            socket.off('socket_event', listener);
            socket.off('update', listener);

            const duration = Date.now() - context.vars.startTime;
            events.emit('histogram', `latency_${context.vars.queryName}`, duration);
            return done();
        }
        else if (data.status === 'FAILED' || data.status === 'CANCELLED') {
            clearTimeout(timeoutHandle);
            socket.off('socket_event', listener);
            socket.off('update', listener);
            return done(new Error(`Server returned ${data.status}`));
        }
    };

    socket.on('update', listener);
}
