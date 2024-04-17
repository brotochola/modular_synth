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

// function createLine(from, to) {
//   let line = document.createElement("div");
//   line.classList.add("line");
//   let fromBox = from.getBoundingClientRect();
//   let toBox = to.getBoundingClientRect();

//   // let parentBox=to.parentElement.getBoundingClientRect()

//   var fT = fromBox.y + fromBox.height / 2;
//   var tT = toBox.y + toBox.height / 2;
//   var fL = fromBox.x + fromBox.width / 2;
//   var tL = toBox.x + toBox.width / 2;

//   var CA = Math.abs(tT - fT);
//   var CO = Math.abs(tL - fL);
//   var H = Math.sqrt(CA * CA + CO * CO);
//   var ANG = (180 / Math.PI) * Math.acos(CA / H);

//   if (tT > fT) {
//     var top = (tT - fT) / 2 + fT;
//   } else {
//     var top = (fT - tT) / 2 + tT;
//   }
//   if (tL > fL) {
//     var left = (tL - fL) / 2 + fL;
//   } else {
//     var left = (fL - tL) / 2 + tL;
//   }

//   if (
//     (fT < tT && fL < tL) ||
//     (tT < fT && tL < fL) ||
//     (fT > tT && fL > tL) ||
//     (tT > fT && tL > fL)
//   ) {
//     ANG *= -1;
//   }
//   top -= H / 2;
//   let rotation = "rotate(" + ANG + "deg)";
//   line.style["-webkit-transform"] = rotation;
//   line.style["-moz-transform"] = rotation;
//   line.style["-ms-transform"] = rotation;
//   line.style["-o-transform"] = rotation;
//   line.style["-transform"] = rotation;

//   line.style.height = H + "px";
//   line.style.setProperty("--x", left + "px");
//   line.style.setProperty("--y", top + "px");
//   line.style.setProperty("--height", H + "px");
//   line.style.setProperty("--rotation", rotation);

//   line.style.left = "calc(var(--x) - var(--mainContainerX))";
//   line.style.top = "calc(var(--y) - var(--mainContainerY))";

//   return line;
// }

function figureOutWhereToConnect(compoSource, compoTarget, input) {
  let whereToConnect;
  let whichInput;
  if (compoTarget.type.toLowerCase() == "output") {
    whereToConnect = compoSource.app.actx.destination;
  } else {
    //IF THE CONNECTION STARTS WITH "IN" CONNECT TO THE NODE ITSELF, AS AUDIO INPUT
    //OTHERWISE CONNECT TO THE NODE'S AUDIO PARAMETER (FREQUENCY FOR EXAMPLE)

    if (input.startsWith("in")) {
      whereToConnect = compoTarget.node;
      whichInput = parseInt(input.split("_")[1]);
    } else {
      //TRY TO GET A NORMAL AUDIO PARAM
      whereToConnect = compoTarget.node[input];
    }

    if (!whereToConnect && compoTarget.node?.parameters?.get(input)) {
      whereToConnect = compoTarget.node?.parameters?.get(input);
    }

    if ((compoTarget.customAudioParams || []).includes(input)) {
      for (let i = 0; i < compoTarget.customAudioParams.length; i++) {
        if (compoTarget.customAudioParams[i] == input) {
          whereToConnect = compoTarget.customAudioParamsWorkletNode;
          whichInput = i;
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

String.prototype.toRGB = function() {
  var hash = 0;
  if (this.length === 0) return hash;
  for (var i = 0; i < this.length; i++) {
      hash = this.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
  }
  var rgb = [0, 0, 0];
  for (var i = 0; i < 3; i++) {
      var value = (hash >> (i * 8)) & 255;
      rgb[i] = value;
  }
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

