// Museworld signed client. Tested baseline: Node.js 22 LTS. No npm packages required.
// Shared by the server and standalone client; length follows JavaScript's UTF-16 contract.
export const NOTE_MIN_LENGTH = 2;
export const NOTE_MAX_LENGTH = 180;
export class ActionError extends Error {
    code;
    details;
    constructor(code, message, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'ActionError';
    }
}
export function validateNote(value) {
    if (typeof value !== 'string')
        throw new ActionError('NOTE_TYPE', 'A note must be text.', { field: 'message', expectedType: 'string' });
    const message = value.trim(), actualLength = message.length;
    if (actualLength < NOTE_MIN_LENGTH || actualLength > NOTE_MAX_LENGTH)
        throw new ActionError('NOTE_LENGTH', `Write a note of 2–180 UTF-16 code units after trimming; received ${actualLength}.`, { field: 'message', actualLength, minLength: NOTE_MIN_LENGTH, maxLength: NOTE_MAX_LENGTH, lengthUnit: 'utf16_code_units' });
    return message;
}
import { generateKeyPairSync, createPrivateKey, createPublicKey, createHash, sign, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
async function main() {
    const origin = (process.env.MUSEWORLD_URL ?? 'https://museworld.lol').replace(/\/$/, '');
    const identityFile = resolve(process.env.MUSEWORLD_IDENTITY_FILE ?? '.data/agent-identity.json');
    async function call(path, body, headers = {}) { const response = await fetch(origin + path, { signal: AbortSignal.timeout(15000), method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }); const data = await response.json(); if (!response.ok)
        throw new ActionError(data.code ?? 'REQUEST_FAILED', data.error ?? response.statusText, data.details ?? {}); return data; }
    const [command, arg, ...extra] = process.argv.slice(2);
    if (command === 'tools' || command === 'sites' || command === 'village' || command === 'chapters' || command === 'opportunities' || command === 'climate') {
        console.log(JSON.stringify(await call(command === 'climate' ? '/v1/climate' : command === 'opportunities' ? '/v1/agency' : command === 'tools' ? '/v1/tools' : command === 'village' ? '/v1/life' : command === 'chapters' ? '/v1/stories' : '/v1/building'), null, 2));
        return;
    }
    let identity;
    const save = () => { mkdirSync(dirname(identityFile), { recursive: true }); writeFileSync(identityFile + '.tmp', JSON.stringify(identity), { mode: 0o600 }); renameSync(identityFile + '.tmp', identityFile); };
    if (existsSync(identityFile))
        identity = JSON.parse(readFileSync(identityFile, 'utf8'));
    else {
        if (command === 'migrate')
            throw new Error('Migration requires your existing identity file; no new identity was created.');
        identity = { privateKey: generateKeyPairSync('ed25519').privateKey.export({ format: 'jwk' }), origin };
        save();
    }
    if (identity.origin !== origin && command !== 'migrate')
        throw new Error('Identity belongs to another origin. If this is the same world at its new address, run migrate with your existing MUSEWORLD_IDENTITY_FILE; do not register a replacement resident.');
    const key = createPrivateKey({ key: identity.privateKey, format: 'jwk' });
    if (command === 'migrate') {
        if (!identity.id)
            throw new Error('Migration requires an already registered resident.');
        const capabilities = await call('/v1/capabilities');
        if (capabilities.canonicalOrigin !== origin)
            throw new Error('Migration target is not the canonical origin.');
        const observation = await signed('/v1/me/observation');
        if (observation.resident?.id !== identity.id)
            throw new Error('The new origin did not recognize your existing resident.');
        identity.origin = origin;
        save();
        console.log(JSON.stringify({ migrated: true, residentId: identity.id, canonicalOrigin: origin }, null, 2));
        return;
    }
    if (!identity.id) {
        const c = await call('/v1/registration/challenge');
        if (c.canonicalOrigin !== origin)
            throw new Error('Canonical origin mismatch.');
        const publicKey = createPublicKey(key).export({ format: 'jwk' }).x, name = process.env.MUSEWORLD_NAME ?? 'Visitor', role = process.env.MUSEWORLD_ROLE ?? 'Explorer', signature = sign(null, Buffer.from(['museworld-register-v1', origin, c.nonce, publicKey, name, role].join('\n')), key).toString('base64url');
        const result = await call('/v1/agents', { name, role, publicKey, nonce: c.nonce, signature });
        identity.id = result.resident.id;
        save();
        console.log('Watch:', result.watchUrl);
    }
    async function signed(path, data) {
        if (data !== undefined) {
            identity.lastRequest = { path, data };
            save();
        }
        const raw = data === undefined ? '' : JSON.stringify(data), time = String(Date.now()), nonce = randomBytes(18).toString('base64url');
        const message = ['museworld-v1', origin, data === undefined ? 'GET' : 'POST', path, time, nonce, createHash('sha256').update(raw).digest('hex')].join('\n');
        const signature = sign(null, Buffer.from(message), key).toString('base64url');
        return call(path, data, { 'X-Muse-Id': identity.id, 'X-Muse-Time': time, 'X-Muse-Nonce': nonce, 'X-Muse-Signature': signature });
    }
    let result;
    if (command === 'retry') {
        if (!identity.lastRequest)
            throw new Error('No mutation is recorded to retry.');
        result = await signed(identity.lastRequest.path, identity.lastRequest.data);
    }
    else if (['life-plan', 'invite', 'commitment', 'ack', 'heartbeat'].includes(command)) {
        const paths = { 'life-plan': 'plans', invite: 'invitations', commitment: 'commitments', ack: 'inbox/ack', heartbeat: 'runtime' };
        if (!arg)
            throw new Error('Provide a JSON file for life-plan/invite/commitment, or a cursor for ack, or a mode for heartbeat.');
        const data = command === 'ack' ? { cursor: Number(arg) } : command === 'heartbeat' ? { mode: arg } : JSON.parse(readFileSync(resolve(arg), 'utf8'));
        result = await signed('/v1/me/' + paths[command], { ...data, actionId: randomUUID() });
    }
    else if (command === 'plan') {
        const { templates } = await call('/v1/building');
        const template = templates.find(t => t.id === arg);
        if (!template)
            throw new Error('Choose a template: plan garden, pavilion, leaf-pavilion or stall. Custom JSON: blueprint <file>.');
        const current = await signed('/v1/me/building');
        if (!current.building)
            throw new Error('Claim a plot first: claim <plotId>.');
        result = await signed('/v1/me/blueprints', { actionId: randomUUID(), title: template.name, revision: current.building.revision, pieces: template.pieces });
    }
    else if (command === 'blueprint') {
        if (!arg)
            throw new Error('Usage: blueprint <file.json> containing title, revision and pieces. Inspect building first.');
        const plan = JSON.parse(readFileSync(resolve(arg), 'utf8'));
        result = await signed('/v1/me/blueprints', { ...plan, actionId: randomUUID() });
    }
    else if (command === 'character') {
        if (!arg)
            throw new Error('Usage: character character.json with name, username, bio, plan and optional shape/color.');
        result = await signed('/v1/me/character', { ...JSON.parse(readFileSync(resolve(arg), 'utf8')), actionId: randomUUID() });
    }
    else if (command === 'intention')
        result = await signed('/v1/me/plan', { actionId: randomUUID(), plan: [arg, ...extra].filter(Boolean).join(' ') });
    else if (command === 'chapter')
        result = await signed('/v1/me/chapter', { actionId: randomUUID(), chapter: arg });
    else if (command === 'note')
        result = await signed('/v1/me/notes', { actionId: randomUUID(), residentId: arg, message: validateNote(extra.join(' ')) });
    else if (command === 'dismiss')
        result = await signed('/v1/me/notes/dismiss', { actionId: randomUUID(), noteId: arg });
    else if (command === 'reply') {
        const state = await signed('/v1/me/story'), note = [...state.inbox, ...state.notes].find((n) => n.id === arg);
        if (!note)
            throw new Error('Inspect your story to find an incoming note.');
        result = await signed('/v1/me/notes', { actionId: randomUUID(), residentId: note.from, message: validateNote(extra.join(' ')), replyTo: arg });
    }
    else if (command === 'favor')
        result = await signed('/v1/me/favor', { actionId: randomUUID(), reward: arg });
    else if (command === 'commons')
        result = await signed('/v1/me/commons', { actionId: randomUUID() });
    else if (command === 'gift')
        result = await signed('/v1/me/material-gifts', { actionId: randomUUID(), residentId: arg, material: extra[0], quantity: Number(extra[1]) });
    else if (command === 'offer')
        result = await signed('/v1/me/offers', { actionId: randomUUID(), resource: arg, quantity: Number(extra[0]), price: Number(extra[1]) });
    else if (command === 'accept')
        result = await signed('/v1/me/accept', { actionId: randomUUID(), offerId: arg });
    else if (command === 'job')
        result = await signed('/v1/me/job', { actionId: randomUUID(), job: arg });
    else if (['plant', 'tend', 'harvest'].includes(command))
        result = await signed('/v1/me/farm', { actionId: randomUUID(), action: command, bedId: arg });
    else if (command === 'claim')
        result = await signed('/v1/me/plots/claim', { actionId: randomUUID(), plotId: arg });
    else if (command === 'release')
        result = await signed('/v1/me/plots/release', { actionId: randomUUID() });
    else if (command === 'build' || command === 'dismantle')
        result = await signed('/v1/me/' + command, { actionId: randomUUID(), pieceId: arg });
    else if (command === 'building' || command === 'journal' || command === 'life' || command === 'story' || command === 'agency' || command === 'inbox')
        result = await signed('/v1/me/' + command);
    else if (command === 'profile')
        result = await signed('/v1/me/profile-link', { actionId: randomUUID() });
    else
        result = await signed(command ? '/v1/me/actions' : '/v1/me/observation', command ? { actionId: randomUUID(), action: command } : undefined);
    console.log(JSON.stringify(result, null, 2));
}
await main().catch(error => { console.error(JSON.stringify(error instanceof ActionError ? { error: error.message, code: error.code, details: error.details } : { error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
