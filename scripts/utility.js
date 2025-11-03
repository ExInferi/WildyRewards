// idb-keyval IndexedDB utility functions

import * as idb from './idb-keyval.js';

async function getIDB(key) {
    return await idb.get(key) || [];
}

async function setIDB(key, value) {
    return await idb.set(key, value);
}

async function deleteIDB(...keys) {
    for (const key of keys) {
        await idb.del(key);
    }
}

async function clearIDB() {
    await idb.clear();
}

async function migrateLocalToIDB(key) {
    const localData = localStorage.getItem(key);
    if (localData && localData !== 'null') {
        console.log(`Found key "${key}" in localStorage, migrating to IndexedDB...`);
        // Parse and store in IDB
        const parsed = JSON.parse(localData);
        console.log('Parsed data:', parsed);
        await setIDB(key, parsed);
        console.log(`Set key "${key}" in IndexedDB`);
        // Remove from localStorage after migration
        localStorage.removeItem(key);
        console.log(`Removed key "${key}" from localStorage after migration.`);
        return true;
    }
    return false;
}

// BC sync utility function

function broadcast(channel, msg) {
  const msgEvent = new MessageEvent('message', { data: msg });
  channel.dispatchEvent(msgEvent);
  channel.postMessage(msg);
}

// localStorage utility functions

function createLocalStorage(...keys) {
    keys.forEach(key => {
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, null);
        }
    });
}

function getLocalStorage(key) {
    return JSON.parse(localStorage.getItem(key));
}

function setLocalStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function deleteLocalStorage(...keys) {
    keys.forEach(key => {
        localStorage.removeItem(key);
    });
}

// sessionStorage utility functions

function createSessionStorage(...keys) {
    keys.forEach(key => {
        if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, null);
        }
    });
}

function getSessionStorage(key) {
    return JSON.parse(sessionStorage.getItem(key));
}

function setSessionStorage(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
}

function deleteSessionStorage(...keys) {
    keys.forEach(key => {
        sessionStorage.removeItem(key);
    });
}

// ISO to UK utility functions

function formatDate(isoString) {
    const date = new Date(isoString);
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
}

function formatDownloadDate(date) {
    const pad = (num) => String(num).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// Export utility functions
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export {
    getIDB,
    setIDB,
    deleteIDB,
    clearIDB,
    migrateLocalToIDB,
    broadcast,
    createLocalStorage,
    getLocalStorage,
    setLocalStorage,
    deleteLocalStorage,
    createSessionStorage,
    getSessionStorage,
    setSessionStorage,
    deleteSessionStorage,
    formatDate,
    formatTime,
    formatDateTime,
    formatDownloadDate,
    downloadFile
};