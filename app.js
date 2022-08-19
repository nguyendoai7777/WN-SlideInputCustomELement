const url = 'WFH.flac';

const videoWrapper = document.querySelector('.videoWrapper');
const downloadBtn = document.querySelector('.download');
const abortBtn = document.querySelector('.abort');
const reports = document.querySelector('.reports');
const play = document.querySelector('.play');

const audio = new Audio();
function playAudio() {
  const controller = new AbortController();
  const signal = controller.signal;
  fetch(url, { signal })
    .then((response) => {
      return response.blob();
    })
    .then((blob) => {
      const audioSrc = URL.createObjectURL(blob);
      audio.src = audioSrc;
      setTimeout(() => {
        audio.play();
        audio.loop = true;
      }, 1000);
    });
}

play.addEventListener('click', playAudio);
function onSlideChange(thisEle) {
  console.log(thisEle.currentValue);
}
