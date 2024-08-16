import * as util from './utility.js';

// Enable "Add App" button for Alt1 Browser
A1lib.identifyApp('appconfig.json');

// Set up main constants
const APP_PREFIX = 'beach';

const SELECTED_CHAT = `${APP_PREFIX}Chat`;
const DATA_STORAGE = `${APP_PREFIX}Data`;
const CHAT_SESSION = `${APP_PREFIX}ChatHistory`;
const TOTALS_PREFIX = `${APP_PREFIX}Totals_`;
const DISPLAY_MODE = `${APP_PREFIX}Display`;

// Themed app color
const COL = [180, 195, 152];

// Addional constants
const appURL = window.location.href.replace('index.html', '');
const appColor = A1lib.mixColor(COL[0], COL[1], COL[2]);
const rgbColor = `rgb(${COL[0]}, ${COL[1]}, ${COL[2]})`;
const showTotals = document.getElementById('show-totals');

// Set Chat reader
let reader = new Chatbox.default();
reader.readargs = {
  colors: [
    A1lib.mixColor(255, 255, 0), // Skilling Reward text color
    A1lib.mixColor(255, 255, 255), // Pinata Reward text color
    // A1lib.mixColor(127,169,255), // Test Chat text color
  ],
  backwards: true,
};

// Setup main storage variables
util.createLocalStorage(DATA_STORAGE);
let saveData = util.getLocalStorage(DATA_STORAGE) || [];
util.createSessionStorage(CHAT_SESSION);
let saveChatHistory = util.getSessionStorage(CHAT_SESSION) || [];

// CUSTOM: Setup additional storage variables
util.createLocalStorage('clawdiaKills', 'pinatasOpened');
let clawdiaKills = parseInt(util.getLocalStorage('clawdiaKills')) || 0;
let pinatasOpened = parseInt(util.getLocalStorage('pinatasOpened')) || 0;

// Find all visible chatboxes on screen
if (!window.alt1) {
  $('#item-list').html(`Alt1 not detected. <a href='alt1:// Addapp/${appURL}appconfig.json'>Click here to add the app to Alt1</a>`);
} else {
  $('#item-list').html('Searching for chatboxes...');
}
window.addEventListener('load', function () {
  reader.find();
  reader.read();
})

let findChat = setInterval(function () {
  if (reader.pos === null)
    reader.find();
  else {
    clearInterval(findChat);
    reader.pos.boxes.map((box, i) => {
      $('.chat').append(`<option value=${i}>Chat ${i}</option>`);
    });
    const selectedChat = localStorage.getItem(SELECTED_CHAT);
    if (selectedChat) {
      reader.pos.mainbox = reader.pos.boxes[selectedChat];
    } else {
      // If multiple boxes are found, this will select the first, which should be the top-most chat box on the screen
      reader.pos.mainbox = reader.pos.boxes[0];
      localStorage.setItem(SELECTED_CHAT, 0);
    }
    showSelectedChat(reader.pos);
    // Build table from saved data, start tracking
    showItems();
    setInterval(function () {
      readChatbox();
    }, 300);
  }
}, 1000);

function showSelectedChat(chat) {
  // Attempt to show a temporary rectangle around the chatbox, skip if overlay is not enabled
  try {
    alt1.overLayRect(
      appColor,
      chat.mainbox.rect.x,
      chat.mainbox.rect.y,
      chat.mainbox.rect.width,
      chat.mainbox.rect.height,
      2000,
      5
    );
  } catch { }
}

// Reading and parsing info from the chatbox
function readChatbox() {
  let opts = reader.read() || [];
  let chat = '';

  for (let a in opts) {
    chat += opts[a].text + ' ';
  }
  // Check if the chat message contains any of the following strings
  const found = [
    chat.indexOf('While training on the beach') > -1,
    chat.indexOf('You have received') > -1,
    chat.indexOf('You open the pinata loot bag') > -1
  ];

  const foundReward = found[0];
  // CUSTOM: Additional sources to check for
  const foundClawdia = found[1];
  const foundPinata = found[2];

  if (found.includes(true)) {
    if (foundReward) {
      const regex = /(\[\d+:\d+:\d+\]) While training on the beach you find: ((\d+ x )?[A-Za-z\s'()\d]*)/
      const item = chat.match(regex)[0];
      saveSingleItem(item, regex, 'Skilling Reward');
    } else if (foundPinata) {
      const regex = /(\[\d+:\d+:\d+\]) You receive: ((\d+ x )?[A-Za-z\s'()\d]*)/;
      const pinata = chat.match(/(\[\d+:\d+:\d+\]) You receive: ([A-Za-z\s'()\d]*)/g);
      saveMultipleItems(pinata, regex, 'Pinata Loot', 'pinatasOpened');

    } else if (foundClawdia) {

      const regex = /(\[\d+:\d+:\d+\]) You have received: ([A-Za-z\s'\-!()\d]*?)( x \d+)/;
      const clawdia = chat.match(/(\[\d+:\d+:\d+\]) You have received: ([A-Za-z\s'\-!()\d]*)/g);
      saveMultipleItems(clawdia, regex, 'Clawdia Drop', 'clawdiaKills');
    } else {
      console.warn('Unknown source');
      return;
    }
  }
}

// Save single item
function saveSingleItem(match, regex, source, counter) {
  if (counter) {
    let num = parseInt(localStorage.getItem(counter));
    num += 1;
    localStorage.setItem(counter, num);
  }

  saveItem(regex, match, source);
}

// In case of possible multiple items, save them all
function saveMultipleItems(match, regex, source, counter) {
  const filtered = filterItems(match, regex);

  let alreadySaved = false;
  filtered.forEach((item) => {
    // Check if the counter has already been incremented
    if (saveChatHistory.includes(item)) {
      alreadySaved = true;
    }

    saveItem(regex, item, source)
  });
  if (counter && !alreadySaved) {
    let num = parseInt(localStorage.getItem(counter));
    num += 1;
    localStorage.setItem(counter, num);
  }
}

// Add together all items of the same type
function filterItems(items, regex) {
  const filteredItemsMap = items.reduce((acc, itemString) => {
    const match = itemString.match(regex);
    if (match) {
      const itemName = match[2].trim();
      const quantityMatch = match[3] ? match[3].match(/\d+/) : ['1'];
      const quantity = parseInt(quantityMatch[0], 10);

      if (acc[itemName]) {
        acc[itemName] += quantity;
      } else {
        acc[itemName] = quantity;
      }
    }
    return acc;
  }, {});

  // Then, create a new array with updated quantities for each item
  const updatedItemsArray = items.map(itemString => {
    const match = itemString.match(regex);
    if (match) {
      const itemName = match[2].trim();
      const totalQuantity = filteredItemsMap[itemName];
      // Replace the quantity in the original string
      return itemString.replace(/(?: x (\d+))|(?:(\d+) x )/, (match, group1, group2) => {
        const digit = group1 || group2;
        return match.replace(digit, totalQuantity);
      });
    }
    return itemString;
  });
  // Update the saveChatHistory with the original item that was modified
  items.forEach(item => {
    if (!updatedItemsArray.includes(item) && !saveChatHistory.includes(item)) {
      saveChatHistory.push(item);
    }
  });
  return updatedItemsArray;
}

function saveItem(regex, item, src) {
  if (saveChatHistory.includes(item)) {
    console.debug('Duplicate:', item);
    return;
  }
  saveChatHistory.push(item);
  util.setSessionStorage(CHAT_SESSION, saveChatHistory);

  const reward = item.match(regex);
  console.log(reward[0])
  const date = new Date();

  const itemName = reward[2].replace(reward[3], '');
  const itemAmount = !reward[3] ? 1 : reward[3].match(/\d+/);
  const itemSource = src || APP_PREFIX;
  const itemTime = date.toISOString();

  const getItem = {
    item: `${itemAmount} x ${itemName}`,
    source: itemSource,
    time: itemTime
  };
  console.log(getItem);
  saveData.push(getItem);
  util.setLocalStorage(DATA_STORAGE, saveData);
  showItems();
}

// Function to determine the total of all items recorded
function getTotal(source) {
  let total = {};
  saveData.forEach(item => {
    if (item.source === source || source === undefined) {
      const data = item.item.split(' x ');
      total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
    }
  })
  return total;
}

// Function to display totals on top of the list
function displayTotal(text, total) {
  $('#item-list').append(`<li style="color:${rgbColor}">${text}: <strong>${total}</strong></li>`);
}

// Function to create a list of all items and their totals
function createList(total, type) {
  if (type === 'history') {
    saveData.slice().reverse().map(item => {
      $('#item-list').append(
        `<li title="From: ${item.source} @ ${util.formatDateTime(item.time)}">${item.item}</li>`
      )
    })
  } else {
    Object.keys(total).sort().forEach(item => $('#item-list').append(
      `<li>${item}: ${total[item]}</li>`
    ))
  }
}

function showItems() {
  $('#item-list').empty();

  let display = util.getLocalStorage(DISPLAY_MODE) || 'history';
  let total = getTotal();
  let text = 'Total Rewards';
  let type = null

  // TODO: Change layout with tabs, so this code can be removed
  switch (display) {
    case 'total': {
      $('#item-list').append(`<li data-show="history" title="Click to show Reward History">Reward Item Totals</li>`);
    }
      break;
    case 'history': {
      $('#item-list').append(`<li data-show="skilling" title="Click to show Skilling Reward Totals">Reward History</li>`);
      type = 'history';
    }
      break;
    // CUSTOM: Additional displays for custom sources
    case 'skilling': {
      $('#item-list').append(`<li data-show="clawdia" title="Click to show Clawdia Drop Totals">Skilling Reward Totals</li>`);
      total = getTotal('Skilling Reward');
      text = 'Total Skilling Rewards';
    }
      break;
    case 'clawdia': {
      $('#item-list').append(`<li data-show="pinata" title="Click to show all Pinata Loot Totals">Clawdia Drop Totals</li>`);
      total = getTotal('Clawdia Drop');
      text = 'Total Clawdia Drops';
    }
      break;
    case 'pinata': {
      $('#item-list').append(`<li data-show="total" title="Click to show all Reward Totals">Pinata Loot Totals</li>`);
      total = getTotal('Pinata Loot');
      text = 'Total Pinata Loots';
    }
      break;
  }
  if (showTotals.checked) {
    let totalRewards = saveData.length;
    // CUSTOM: Additional totals for custom sources
    if (display !== 'total' || display !== 'history') {
      let skillingRewards = 0;
      let pinataRewards = 0;
      let clawdiaRewards = 0;

      saveData.forEach(item => {
        switch (item.source) {
          case 'Skilling Reward':
            skillingRewards++;
            break;
          case 'Pinata Loot':
            pinataRewards++;
            break;
          case 'Clawdia Drop':
            clawdiaRewards++;
            break;
        }
      });

      // CUSTOM: Additional totals for custom sources
      switch (display) {
        case 'skilling':
          totalRewards = skillingRewards;
          break;
        case 'clawdia':
          totalRewards = clawdiaRewards;
          break;
        case 'pinata':
          totalRewards = pinataRewards;
          break;
      }
    }

    displayTotal(text, totalRewards);
  }

  createList(total, type);
}

// Create content for CSV
function createExportData(type) {
  let str = 'Item,Qty\n';
  let total = getTotal();
  switch (type) {
    case 'total':
      break;
    case 'history':
      str = 'Item,Source,Date,Time\n';
      break;
    // CUSTOM: Additional exports for custom sources
    case 'skilling':
      total = getTotal('Skilling Reward');
      break;
    case 'clawdia':
      total = getTotal('Clawdia Drop');
      break;
    case 'pinata':
      total = getTotal('Pinata Loot');
      break;
    // End custom
    default: {
      console.warn('Display mode:', util.getLocalStorage(DISPLAY_MODE));
      throw new Error('Unknown display mode');
    }
  }

  if (type === 'history') {
    saveData.forEach((item) => {
      str += `${item.item},${item.source},${util.formatDateTime(item.time)}\n`;
    });
  } else {
    Object.keys(total).sort().forEach(item => str += `${item},${total[item]}\n`);
  }
  return str;
}

// Event listeners

$(function () {

  // Changing which chatbox to read
  $('.chat').change(function () {
    reader.pos.mainbox = reader.pos.boxes[$(this).val()];
    showSelectedChat(reader.pos);
    localStorage.setItem(SELECTED_CHAT, $(this).val());
    $(this).val('');
  });

  // Export current overview to CSV-file
  $('.export').click(function () {
    const exportDate = new Date();
    const downloadDate = util.formatDownloadDate(exportDate);
    const display = util.getLocalStorage(DISPLAY_MODE);
    const csv = createExportData(display);
    let fileName;

    switch (display) {
      case 'total':
        fileName = `${APP_PREFIX}TotalExport_${downloadDate}.csv`;
        break;
      case 'history':
        fileName = `${APP_PREFIX}HistoryExport_${downloadDate}.csv`;
        break;
      // CUSTOM: Additional exports names for custom sources
      case 'skilling':
        fileName = `skillingRewardTotalExport_${downloadDate}.csv`;
        break;
      case 'clawdia':
        fileName = `clawdiaRewardTotalExport_${downloadDate}.csv`;
        break;
      case 'pinata':
        fileName = `pinataRewardTotalExport_${downloadDate}.csv`;
        break;
      default:
    }

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });

    util.downloadFile(blob, fileName);
  });

  // Factory reset
  $('.clear').click(function () {
    util.deleteLocalStorage(DATA_STORAGE, SELECTED_CHAT, DISPLAY_MODE, `${TOTALS_PREFIX}hide`, `${TOTALS_PREFIX}show`);
    util.deleteSessionStorage(CHAT_SESSION);
    $('#show-totals').prop('checked', true);

    location.reload();
  })

  // Toggle display mode
  $(document).on('click', 'li:first-child', function () {
    util.setLocalStorage(DISPLAY_MODE, `${$(this).data('show')}`);
    showItems()
  })
});

// Toggle totals display
$(function () {
  $('[data-totals]').each(function () {
    $(this).click(showItems);
  });

  $('[data-totals]').each(function () {
    let state = util.getLocalStorage(`${TOTALS_PREFIX}${$(this).data('totals')}`);
    if (state) this.checked = state.checked;
  });
});


$(window).bind('unload', function () {
  $('[data-totals]').each(function () {
    const key = `${TOTALS_PREFIX}${$(this).data('totals')}`;
    const value = { checked: this.checked };

    util.setLocalStorage(key, value);
  });
});

// Event listener to check if data has been altered
window.addEventListener('storage', function (e) {
  let dataChanged = false;

  switch (e.key) {
    case DATA_STORAGE: {
      let changedData = util.getLocalStorage(DATA_STORAGE);
      let lastChange = changedData[changedData.length - 1];
      let lastSave = [saveData[saveData.length - 1]]
      if (lastChange != lastSave) {
        saveData = changedData;
        dataChanged = true;
      }
    }
      break;
    // CUSTOM: Additional storage keys to check for changes in count
    case 'clawdiaKills': {
      let changedKills = parseInt(util.getLocalStorage('clawdiaKills'));
      if (clawdiaKills != changedKills) {
        clawdiaKills = changedKills;
        dataChanged = true;
      }
    }
      break;
    case 'pinatasOpened': {
      let changedPinatas = parseInt(util.getLocalStorage('pinatasOpened'));
      if (pinatasOpened != changedPinatas) {
        pinatasOpened = changedPinatas;
        dataChanged = true;
      }
    }
      break;
  }

  if (dataChanged) {
    showItems();
  }
  console.debug('Data changed:', e.key);
});

// Force read chatbox
A1lib.on('alt1pressed', readChatbox);