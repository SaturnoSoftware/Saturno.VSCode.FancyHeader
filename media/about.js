(function () {
  var vscode = acquireVsCodeApi();

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-command]");
    if (!target) {
      return;
    }
    vscode.postMessage({ command: target.getAttribute("data-command") });
  });
})();
