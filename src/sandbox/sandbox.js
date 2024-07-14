let script;

window.addEventListener('message', e => {
  if (typeof e.data === 'object' && e.data.executeScript) {
    script = e.data.executeScript;

    let isExecuted = false;

    try {
      new Function(e.data.executeScript.script)();
      isExecuted = true;
    } catch (e) {
    }

    e.source.window.postMessage({'msdExecuteScript': isExecuted}, e.origin);
  } else if (typeof e.data === 'object' && e.data.generateToken) {
    const {id, type, index} = e.data.generateToken;

    const token = window.generateToken(id + type + index + script.randomToken)?.substring(0, 4);
    e.source.window.postMessage({'msdGenerateToken': token}, e.origin);
  }
});
