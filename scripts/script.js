//Enable "Add App" button for Alt1 Browser.
A1lib.identifyApp("appconfig.json");
const url = window.location.href.replace('index.html', '');
const COL = [255, 255, 0]; // Themed app color
const appColor = A1lib.mixColor(COL[0], COL[1], COL[2]);
const rgbColor = `rgb(${COL[0]}, ${COL[1]}, ${COL[2]})`;

// Set Chat reader
let reader = new Chatbox.default();
reader.readargs = {
  colors: [
    A1lib.mixColor(255, 255, 0), // Skilling Reward text color
    A1lib.mixColor(255, 255, 255), // Pinata Reward text color
    // A1lib.mixColor(127,169,255), //Test Chat text color
  ],
  backwards: true,
};

//Setup localStorage variable.
if (!localStorage.beachData) {
  localStorage.setItem("beachData", JSON.stringify([]))
}
let saveData = JSON.parse(localStorage.beachData);

if (!sessionStorage.beachChatHistory) {
  sessionStorage.setItem("beachChatHistory", JSON.stringify([]))
}
let saveChatHistory = JSON.parse(sessionStorage.beachChatHistory)

if (!localStorage.beachDisplay) {
  localStorage.setItem("beachDisplay", "history")
}
if (!localStorage.clawdiaKills) {
  localStorage.setItem("clawdiaKills", 0)
}
let clawdiaKills = parseInt(localStorage.clawdiaKills)

if (!localStorage.pinatasOpened) {
  let pinataRewards = 0;
  saveData.forEach(item => {
    if (item.source === 'Pinata Loot') {
      pinataRewards++;
    }
  });
  localStorage.setItem("pinatasOpened", pinataRewards / 2 | 0)
}
let pinatasOpened = parseInt(localStorage.pinatasOpened)

//Find all visible chatboxes on screen
if (!window.alt1) {
  $(".itemList").append(`<li class='list-group-item'>Alt1 not detected. <a href='alt1://addapp/${url}appconfig.json'>Click here to add the app to Alt1</a></li>`);
} else {
  $(".itemList").append("<li class='list-group-item'>Searching for chatboxes</li>");
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
      $(".chat").append(`<option value=${i}>Chat ${i}</option>`);
    });

    if (localStorage.beachChat) {
      reader.pos.mainbox = reader.pos.boxes[localStorage.beachChat];
    } else {
      //If multiple boxes are found, this will select the first, which should be the top-most chat box on the screen.
      reader.pos.mainbox = reader.pos.boxes[0];
    }
    showSelectedChat(reader.pos);
    //build table from saved data, start tracking.
    showItems();
    setInterval(function () {
      readChatbox();
    }, 300);
  }
}, 1000);

function showSelectedChat(chat) {
  //Attempt to show a temporary rectangle around the chatbox.  skip if overlay is not enabled.
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
let lastRewardDetected;
//Reading and parsing info from the chatbox.
function readChatbox() {
  let opts = reader.read() || [];
  let chat = "";

  for (let a in opts) {
    chat += opts[a].text + " ";
  }
  const foundBeach = chat.indexOf('While training on the beach') > -1;
  const foundClawdia = chat.indexOf("You have received") > -1;
  const foundPinata = chat.indexOf("You open the pinata loot bag") > -1;

  if (foundBeach || foundClawdia || foundPinata) {
    if (foundBeach) {
      const regex = /(\[\d+:\d+:\d+\]) While training on the beach you find: ((\d+ x )?[A-Za-z\s'()\d]*)/
      const item = chat.match(regex)[0];
      saveItem(item, 'Skilling Reward', regex)
    } else if (foundPinata) {
      let captured = false

      const regex = /(\[\d+:\d+:\d+\]) You receive: ((\d+ x )?[A-Za-z\s'()\d]*)/
      const pinata = chat.match(/(\[\d+:\d+:\d+\]) You receive: ([A-Za-z\s'()\d]*)/g)
      const filtered = filterItems(pinata, regex);
      // Check if the captured item is already saved
      filtered.forEach((item) => {
        if (saveChatHistory.includes(item)) {
          captured = true;
        }
      });
      if (captured) {
        return;
      }
      filtered.forEach((item) => {
        saveItem(item, 'Pinata Loot', regex)
      });
    } else if (foundClawdia) {
      let captured = false

      const regex = /(\[\d+:\d+:\d+\]) You have received: ([A-Za-z\s'\-!()\d]*?)( x \d+)/
      const clawdia = chat.match(/(\[\d+:\d+:\d+\]) You have received: ([A-Za-z\s'\-!()\d]*)/g)
      const filtered = filterItems(clawdia, regex);
      // Check if the captured item is already saved
      filtered.forEach((item) => {
        if (saveChatHistory.includes(item)) {
          captured = true;
        }
      });
      if (captured) {
        return;
      }
      clawdiaKills += 1;
      localStorage.setItem('clawdiaKills', clawdiaKills);
      filtered.forEach((item) => {
        saveItem(item, 'Clawdia Drop', regex)
      })
    } else {
      console.warn("Unknown source");
      return;
    }
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

function saveItem(item, src, regex) {
  if (saveChatHistory.indexOf(item) > -1) {
    console.debug('Duplicate:', item);
    return;
  }
  saveChatHistory.push(item);
  sessionStorage.setItem("beachChatHistory", JSON.stringify(saveChatHistory));

  const reward = item.match(regex);
  console.log(reward[0])
  const date = new Date();

  const itemName = reward[2].replace(reward[3], '');
  const itemAmount = !reward[3] ? 1 : reward[3].match(/\d+/);
  const itemSource = src;
  const itemTime = date.toISOString();

  const getItem = {
    item: `${itemAmount} x ${itemName}`,
    source: itemSource,
    time: itemTime
  };
  console.log(getItem);
  saveData.push(getItem);
  localStorage.setItem("beachData", JSON.stringify(saveData));
  checkAnnounce(getItem);
  showItems();
}

function showItems() {
  $(".itemList").empty();
  let skillingRewards = 0;
  let pinataRewards = 0;
  let clawdiaRewards = 0;
  let showTotals = document.getElementById("show-totals");


  if (showTotals.checked) {
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

  }
  let totalRewards = pinataRewards + skillingRewards + clawdiaRewards;
  let display = localStorage.getItem("beachDisplay");

  if (display === "total") {
    $(".itemList").append(`<li class="list-group-item header" data-show="history" title="Click to show Reward History">Reward Item Totals</li>`);
    let total = getTotal();
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item" style="color:${rgbColor}">Total Rewards: <strong>${totalRewards}</strong></li>`);
    }
    Object.keys(total).sort().forEach(item => $(".itemList").append(`<li class="list-group-item">${item}: ${total[item]}</li>`))
  } else if (display === "history") {
    $(".itemList").append(`<li class="list-group-item header" data-show="skilling" title="Click to show Skilling Reward Totals">Reward History</li>`);
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item" style="color:${rgbColor}">Total Rewards: <strong>${totalRewards}</strong></li>`);
    }
    saveData.slice().reverse().map(item => {
      $(".itemList").append(`<li class="list-group-item" title="From: ${item.source} @ ${new Date(item.time).toLocaleString()}">${item.item}</li>`)
    })
  } else if (display === "skilling") {
    $(".itemList").append(`<li class="list-group-item header" data-show="clawdia" title="Click to show Clawdia Drop Totals">Skilling Reward Totals</li>`);
    let total = getTotalSkilling();
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item" style="color:${rgbColor}">Total Skilling Rewards: <strong>${skillingRewards}</strong></li>`);
    }
    Object.keys(total).sort().forEach(item => {
      $(".itemList").append(`<li class="list-group-item">${item}: ${total[item]}</li>`)
    })
  } else if (display === "clawdia") {
    $(".itemList").append(`<li class="list-group-item header" data-show="pinata" title="Click to show all Pinata Loot Totals">Clawdia Drop Totals</li>`);
    let total = getTotalClawdia();
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item" style="color:${rgbColor}">Total Clawdia Drops: <strong>${clawdiaRewards}</strong> (${clawdiaKills} kc)</li>`);
    }
    Object.keys(total).sort().forEach(item => {
      $(".itemList").append(`<li class="list-group-item">${item}: ${total[item]}</li>`)
    })
  } else if (display === "pinata") {
    $(".itemList").append(`<li class="list-group-item header" data-show="total" title="Click to show all Reward Totals">Pinata Loot Totals</li>`);
    let total = getTotalPinata();
    if (showTotals.checked) {
      $(".itemList").append(`<li class="list-group-item" style="color:${rgbColor}">Total Pinata Loots: <strong>${pinataRewards}</strong> (${pinatasOpened} bags)</li>`);
    }
    Object.keys(total).sort().forEach(item => {
      $(".itemList").append(`<li class="list-group-item">${item}: ${total[item]}</li>`)
    })
  }
}




function checkAnnounce(getItem) {
  if (localStorage.rewardAnnounce) {
    fetch(localStorage.getItem("rewardAnnounce"), {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: "Beach Tracker",
        content: `${new Date(getItem.time).toLocaleString()}: Received - ${getItem.item}`
      })
    })
  }
}

//Function to determine the total of all items recorded.
function getTotal() {
  let total = {};
  saveData.forEach(item => {
    data = item.item.split(" x ");
    total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
  })
  return total;
}

function getTotalSkilling() {
  let total = {};
  saveData.forEach(item => {
    if (item.source === "Skilling Reward") {
      data = item.item.split(" x ");
      total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
    }
  })
  return total;
}

function getTotalPinata() {
  let total = {};
  saveData.forEach(item => {
    if (item.source === "Pinata Loot") {
      data = item.item.split(" x ");
      total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
    }
  })
  return total;
}

function getTotalClawdia() {
  let total = {};
  saveData.forEach(item => {
    if (item.source === "Clawdia Drop") {
      data = item.item.split(" x ");
      total[data[1]] = parseInt(total[data[1]]) + parseInt(data[0]) || parseInt(data[0])
    }
  })
  return total;
}

$(function () {

  $(".chat").change(function () {
    reader.pos.mainbox = reader.pos.boxes[$(this).val()];
    showSelectedChat(reader.pos);
    localStorage.setItem("beachChat", $(this).val());
    $(this).val("");
  });

  $(".export").click(function () {
    var exportDate = new Date();
    var downDate = exportDate.getFullYear().toString() + "-" + (exportDate.getMonth() + 1).toString() + "-" + exportDate.getDate().toString();
    var downTime = exportDate.getHours().toString() + "-" + (exportDate.getMinutes() + 1).toString() + "-" + exportDate.getSeconds().toString();
    var str, fileName;

    //count all rewards
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
    let totalRewards = pinataRewards + skillingRewards + clawdiaRewards;

    //If totals is checked, export totals
    if (localStorage.getItem("beachDisplay") === "total") {
      str = `Item,Qty\nTotal Skilling Rewards,${skillingRewards}\nTotal Pinata Loots,${pinataRewards}\nTotal combined rewards,${totalRewards}\n`;
      let total = getTotal();
      Object.keys(total).sort().forEach(item => str = `${str}${item},${total[item]}\n`);
      fileName = `beachTotalExport_${downDate}_${downTime}.csv`;

      // export list by item and time received.
    } else if (localStorage.getItem("beachDisplay") === "history") {
      str = `Item,Source,Date,Time\n${skillingRewards} x Total Obtained,Skilling Reward,${exportDate.toLocaleDateString()},${exportDate.toLocaleTimeString()}\n${pinataRewards} x Total Obtained,Pinata Loot,${exportDate.toLocaleDateString()},${exportDate.toLocaleTimeString()}\n${totalRewards} x Total Obtained,All Rewards,${exportDate.toLocaleDateString()},${exportDate.toLocaleTimeString()}\n`;
      saveData.forEach((item) => {
        str = `${str}${item.item},${item.source},${new Date(item.time).toLocaleString()}\n`;
      });
      fileName = `rewardHistoryExport_${downDate}_${downTime}.csv`;

      //export total Skilling Rewards
    } else if (localStorage.getItem("beachDisplay") === "skilling") {
      str = "Item,Qty\n";
      let totalSkilling = getTotalSkilling();
      Object.keys(totalSkilling).sort().forEach(item => str = `${str}${item},${totalSkilling[item]}\n`);
      str += `Total rewards,${skillingRewards}`;
      fileName = `skillingRewardTotalExport_${downDate}_${downTime}.csv`;

      //export total Clawdia Drops
    } else if (localStorage.getItem("beachDisplay") === "clawdia") {
      str = "Item,Qty\n";
      let totalClawdia = getTotalClawdia();
      Object.keys(totalClawdia).sort().forEach(item => str = `${str}${item},${totalClawdia[item]}\n`);
      str += `Total rewards,${clawdiaRewards}\nTotal kills,${clawdiaKills}`;
      fileName = `clawdiaRewardTotalExport_${downDate}_${downTime}.csv`;

      //export total Pinata Loots 
    } else if (localStorage.getItem("beachDisplay") === "pinata") {
      str = "Item,Qty\n";
      let totalPinata = getTotalPinata();
      Object.keys(totalPinata).sort().forEach(item => str = `${str}${item},${totalPinata[item]}\n`);
      str += `Total rewards,${pinataRewards}\nTotal bags opened,${pinatasOpened}`;
      fileName = `pinataRewardTotalExport_${downDate}_${downTime}.csv`;
    }

    var blob = new Blob([str], {
      type: "text/csv;charset=utf-8;"
    });
    if (navigator.msSaveBlob) {
      // IE 10+
      navigator.msSaveBlob(blob, fileName);
    } else {
      var link = document.createElement("a");
      if (link.download !== undefined) {
        // feature detection
        // Browsers that support HTML5 download attribute
        var url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  });

  $(".clear").click(function () {
    localStorage.removeItem("beachData");
    localStorage.removeItem("beachChat");
    localStorage.removeItem("beachDisplay")
    localStorage.removeItem("beachTotals_hide-totals")
    localStorage.removeItem("beachTotals_show-totals");
    $("#show-totals").prop("checked", true);

    location.reload();
  })

  $(document).on("click", ".header", function () {
    localStorage.setItem("beachDisplay", $(this).data("show"));
    showItems()
  })
});

$(function () {
  $('input[type=radio]').each(function () {
    var state = JSON.parse(localStorage.getItem('beachTotals_' + this.id));
    if (state) this.checked = state.checked;
  });
});

$(window).bind('unload', function () {
  $('input[type=radio]').each(function () {
    localStorage.setItem('beachTotals_' + this.id, JSON.stringify({
      checked: this.checked
    }));
  });
});



// Event listener to check if data has been altered
window.addEventListener('storage', function (e) {
  let dataChanged = false;

  switch (e.key) {
    case "beachData": {
      let changedData = JSON.parse(localStorage.beachData);
      let lastChange = changedData[changedData.length - 1];
      let lastSave = [saveData[saveData.length - 1]]
      if (lastChange != lastSave) {
        saveData = changedData;
        dataChanged = true;
      }
    }
      break;
    case "clawdiaKills": {
      if (clawdiaKills != parseInt(localStorage.clawdiaKills)) {
        clawdiaKills = parseInt(localStorage.clawdiaKills);
        dataChanged = true;
      }
    }
      break;
    case "pinatasOpened": {
      if (pinatasOpened != parseInt(localStorage.pinatasOpened)) {
        pinatasOpened = parseInt(localStorage.pinatasOpened);
        dataChanged = true;
      }
    }
      break;
  }

  if (dataChanged) {
    showItems();
  }

});

// Force read chatbox
A1lib.on('alt1pressed', readChatbox);