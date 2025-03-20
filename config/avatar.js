const crypto = require('crypto');

function generateAvatarUrl(email) {
    // Create SHA-256 hash of the trimmed lowercase email
    const emailHash = crypto
        .createHash('sha256')
        .update(email.trim().toLowerCase())
        .digest('hex');

    const options = `seed=${emailHash}`;
    const defaultImage = encodeURIComponent(
        `https://api.dicebear.com/9.x/thumbs/png/${encodeURIComponent(options)}`
    );
    return `https://www.gravatar.com/avatar/${emailHash}?d=${defaultImage}`;
}

module.exports = generateAvatarUrl; 