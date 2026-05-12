function generateNodeId() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const firstChar = chars.charAt(Math.floor(Math.random() * chars.length));
    let restChars = '';
    for (let i = 0; i < 10; i++) {
        restChars += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return firstChar + restChars;
}

module.exports = { generateNodeId };
