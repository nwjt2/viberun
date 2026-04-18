const vibeBars = document.getElementById('vibe-bars');
const runButton = document.getElementById('run-vibe');

function createBars(count = 6) {
  vibeBars.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const bar = document.createElement('div');
    bar.className = 'vibe-bar';
    bar.style.animationDelay = `${i * 0.08}s`;
    bar.style.height = `${18 + Math.random() * 100}px`;
    vibeBars.append(bar);
  }
}

function randomizeBars() {
  const bars = Array.from(vibeBars.children);
  bars.forEach((bar) => {
    const scale = 0.35 + Math.random() * 1.1;
    bar.style.transform = `scaleY(${scale})`;
    bar.style.height = `${18 + Math.random() * 120}px`;
  });
}

runButton.addEventListener('click', () => {
  createBars(6);
  const interval = setInterval(randomizeBars, 420);
  runButton.textContent = 'Vibe Running';
  runButton.disabled = true;

  setTimeout(() => {
    clearInterval(interval);
    runButton.textContent = 'Start Vibe';
    runButton.disabled = false;
    createBars(6);
  }, 14000);
});

createBars(6);
