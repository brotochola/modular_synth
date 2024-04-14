function makeChildrenStopPropagation(elem) {
  Array.from(elem.children).map((child) => {
    child.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
  });
}
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeid(length) {
  let result = "";
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function createLine(from, to) {
  let line = document.createElement("div");
  line.classList.add("line");
  let fromBox = from.getBoundingClientRect();
  let toBox = to.getBoundingClientRect();
  var fT = fromBox.y + fromBox.height / 2;
  var tT = toBox.y + toBox.height / 2;
  var fL = fromBox.x + fromBox.width / 2;
  var tL = toBox.x + toBox.width / 2;

  var CA = Math.abs(tT - fT);
  var CO = Math.abs(tL - fL);
  var H = Math.sqrt(CA * CA + CO * CO);
  var ANG = (180 / Math.PI) * Math.acos(CA / H);

  if (tT > fT) {
    var top = (tT - fT) / 2 + fT;
  } else {
    var top = (fT - tT) / 2 + tT;
  }
  if (tL > fL) {
    var left = (tL - fL) / 2 + fL;
  } else {
    var left = (fL - tL) / 2 + tL;
  }

  if (
    (fT < tT && fL < tL) ||
    (tT < fT && tL < fL) ||
    (fT > tT && fL > tL) ||
    (tT > fT && tL > fL)
  ) {
    ANG *= -1;
  }
  top -= H / 2;

  line.style["-webkit-transform"] = "rotate(" + ANG + "deg)";
  line.style["-moz-transform"] = "rotate(" + ANG + "deg)";
  line.style["-ms-transform"] = "rotate(" + ANG + "deg)";
  line.style["-o-transform"] = "rotate(" + ANG + "deg)";
  line.style["-transform"] = "rotate(" + ANG + "deg)";
  line.style.top = top + "px";
  line.style.left = left + "px";
  line.style.height = H + "px";

  return line;
}

function figureOutWhereToConnect(
  compoSource,
  compoTarget,
  input,
  connInstance
) {
  let whereToConnect;
  let whichInput;
  if (compoTarget.type.toLowerCase() == "output") {
    whereToConnect = compoSource.app.actx.destination;
  } else {
    //IF THE CONNECTION STARTS WITH "IN" CONNECT TO THE NODE ITSELF, AS AUDIO INPUT
    //OTHERWISE CONNECT TO THE NODE'S AUDIO PARAMETER (FREQUENCY FOR EXAMPLE)

    if (input.startsWith("in")) {
      whereToConnect = connInstance.to.node;
      whichInput = parseInt(input.split("_")[1]);
    } else {
      whereToConnect = connInstance.to.node[input];
    }

    if ((compoTarget.customAudioParams || []).includes(input)) {
      for (let i = 0; i < compoTarget.customAudioParams.length; i++) {
        if (compoTarget.customAudioParams[i] == input) {
          whereToConnect=compoTarget.customAudioParamsWorkletNode
          whichInput = i
          break;
        }
      }
    }

    //AUDIO NODES MAY HAVE MORE THAN ONE INPUT, SO THIS WAY WHICH CHECK WHICH ONE IT IS
   
  }

  return {
    whereToConnect,
    whichInput: isNaN(whichInput) ? undefined : whichInput,
  };
}
