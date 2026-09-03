(() => {
  const pathEl = document.querySelector("[data-notfound-path]");
  if (pathEl) {
    pathEl.textContent = window.location.pathname || "/";
  }

  const quipEl = document.querySelector("[data-notfound-quip]");
  if (quipEl) {
    const quips = [
      "you wandered off the map",
      "that page pulled a vanishing act",
      "here be dragons",
      "just stray semicolons here",
      "this link had one job",
      "404 bytes of nothing",
      "the void says hi",
      "not the page you're looking for",
      "stack trace leads nowhere",
      "this url was never merged",
    ];
    quipEl.textContent = `# ${quips[Math.floor(Math.random() * quips.length)]}`;
  }

  const cmdInput = document.querySelector("[data-terminal-input]");
  const log = document.querySelector("[data-terminal-log]");
  if (!cmdInput || !log) return;

  const terminal = document.querySelector("[data-terminal]");
  terminal.addEventListener("click", () => cmdInput.focus());

  const println = (text, className) => {
    const p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  };

  const printEcho = (value) => {
    const p = document.createElement("p");
    const user = document.createElement("span");
    user.className = "prompt-user";
    user.textContent = "guest@mlz.no";
    const sep = document.createElement("span");
    sep.className = "prompt-sep";
    sep.textContent = ":~$ ";
    p.append(user, sep, document.createTextNode(value));
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  };

  const files = ["regrets.txt", "old-ideas/", "coffee.log", "excuses.sh"];

  const commands = {
    help: () => "help ls pwd whoami date cat cd home sudo clear",
    ls: () => files.join("  "),
    pwd: () => window.location.pathname || "/",
    whoami: () => "guest (you followed a link that leads nowhere)",
    date: () => new Date().toString(),
    coffee: () => "☕ brewing... still 404 though",
    vim: () => "good luck getting out. (hint: just press enter)",
    42: () => "the answer to life, the universe, and this url",
    home: () => {
      window.location.href = "/";
      return "cd ~";
    },
    clear: () => {
      log.replaceChildren();
      return null;
    },
  };

  const run = (raw) => {
    const value = raw.trim();
    printEcho(raw);
    if (!value) return;
    const [cmd, ...rest] = value.split(/\s+/);
    const arg = rest.join(" ");

    if (cmd === "sudo") {
      println(
        "guest is not in the sudoers file. this incident will be reported (it will not).",
        "no-such",
      );
      return;
    }
    if (cmd === "cd") {
      if (arg === "~" || arg === "/" || arg === "" || arg === "..") {
        commands.home();
        return;
      }
      println(`cd: ${arg}: no such file or directory`, "no-such");
      return;
    }
    if (cmd === "cat") {
      println(
        arg ? `cat: ${arg}: permission denied` : "cat: missing operand",
        "no-such",
      );
      return;
    }
    if (cmd === "rm") {
      println("nice try.", "no-such");
      return;
    }
    if (cmd === "exit" || cmd === "quit") {
      println("there's no escaping a 404. try 'home'.", "no-such");
      return;
    }
    if (Object.hasOwn(commands, cmd)) {
      const out = commands[cmd]();
      if (out) println(out);
      return;
    }
    println(`command not found: ${cmd} — try 'help'`, "no-such");
  };

  const history = [];
  let historyIndex = -1;

  cmdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const value = cmdInput.value;
      if (value.trim()) {
        history.push(value);
      }
      historyIndex = history.length;
      run(value);
      cmdInput.value = "";
      return;
    }
    if (e.key === "ArrowUp") {
      if (historyIndex > 0) {
        historyIndex -= 1;
        cmdInput.value = history[historyIndex];
      }
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      if (historyIndex < history.length - 1) {
        historyIndex += 1;
        cmdInput.value = history[historyIndex];
      } else {
        historyIndex = history.length;
        cmdInput.value = "";
      }
      e.preventDefault();
    }
  });
})();
