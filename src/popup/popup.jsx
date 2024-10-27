import React, {useEffect, useRef, useState} from 'react';
import browser from 'webextension-polyfill';
import {
  getTabByUrl,
  isConnectionOk,
  isMuseScoreUrl,
  isScoreUrl,
  resetBgColorAnimation,
  setLoadingAnimation,
  updateCurrentTab,
} from '../modules/utils';

export default function Popup() {
  const [showContent, setShowContent] = useState(false);
  const [currentTab, setCurrentTab] = useState(null);
  const [isOnMobile, setIsOnMobile] = useState(false);
  const [showSingleBtb, setShowSingleBtb] = useState(false);
  const [singleBtbText, setSingleBtbText] = useState('');
  const [messageState, setMessageState] = useState({message: 'Loading extension', loading: false});
  const loadingRef = useRef(null);

  useEffect(() => {
    browser.runtime.onMessage.addListener(request => {
      if (typeof request !== 'object')
        return;

      if (request.message) {
        showMessage(request.loading ? {...request, btnText: 'Stop', showBtn: true} : request);

        if (request.reset) {
          (async () => {
            setTimeout(() => {
              setShowContent(true);
              resetBgColorAnimation();
            }, 750);
          })();
        }
      }
    });

    setLoadingAnimation(loadingRef);

    (async () => {
      const curr = await updateCurrentTab();
      setCurrentTab(curr);

      if (curr.status === 'complete')
        return;

      const tabListenerHandler = async (tabId, changeInfo) => {
        if (tabId === curr.id && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(tabListenerHandler);
          setCurrentTab(await getTabByUrl(curr.url));
        }
      };

      browser.tabs.onUpdated.addListener(tabListenerHandler);
    })();
  }, []);

  useEffect(() => {
    if (currentTab) {
      initContent().catch(() => {
        showMessage({message: 'Something went wrong'});
      });
    }
  }, [currentTab]);

  const initContent = async () => {
    showMessage({message: 'Loading webpage', loading: true});

    if (currentTab.status !== 'complete')
      return;

    if (!currentTab.url || !isMuseScoreUrl(currentTab.url)) {
      showMessage({message: 'This extension works only on musescore website'});
      return;
    }

    if (!(await isConnectionOk(currentTab.id))) {
      showMessage({message: 'Refresh the score page please', showBtn: true, btnText: 'Refresh'});
      return;
    }

    if (!isScoreUrl(currentTab.url)) {
      const isScorePage = await browser.tabs.sendMessage(currentTab.id, 'isScorePage');
      if (!isScorePage) {
        showMessage({message: 'Cannot detect a score'});
        return;
      }
    }

    const {latestProgressMessage, isOnMobile} = await browser.tabs.sendMessage(currentTab.id, 'getLatestMessage');

    setIsOnMobile(isOnMobile);

    if (latestProgressMessage) {
      showMessage({...latestProgressMessage, showBtn: true, btnText: 'Stop'});
      return;
    }

    setShowContent(true);
    resetBgColorAnimation();
  };

  const showMessage = ({message, loading = false, showBtn = false, btnText = ''}) => {
    setShowContent(false);
    setMessageState({message, loading});

    if (loading)
      setLoadingAnimation(loadingRef);

    if (btnText)
      setSingleBtbText(btnText);

    setShowSingleBtb(showBtn);
  };

  const requestMedia = async type => {
    showMessage({message: 'Sending request', loading: true});

    try {
      if (isOnMobile)
        window.close();

      await browser.tabs.sendMessage(currentTab.id, type);
    } catch (e) {
    }
  };

  const handleSingleBtn = async () => {
    if (singleBtbText === 'Refresh') {
      await refreshPages();
    } else if (singleBtbText === 'Stop') {
      await sendStopSignal();
    }
  };

  const refreshPages = async () => {
    await browser.tabs.reload();
    window.location.reload();
  };

  const sendStopSignal = async () => {
    const isStopped = await browser.tabs.sendMessage(currentTab.id, 'hardStop');

    if (isStopped) {
      setShowContent(true);
      resetBgColorAnimation();
    }
  };

  if (showContent) {
    return (
      <>
        <div className='content'>
          <div className='header__div'>
            <h2 className='header__title'>MS Downloader</h2>
          </div>
          <div className='fun__content'>
            <div>
              <button
                onClick={() => requestMedia('openSheet')}
                className='btn__fun sheet__open'
              >Open Sheet
              </button>
              <button
                onClick={() => requestMedia('downloadSheet')}
                className='btn__fun sheet__download'
              >Download Sheet
              </button>
            </div>
            <div>
              <button
                onClick={() => requestMedia('downloadAudio')}
                className='btn__fun audio__download'
              >Download Audio
              </button>
              <button
                onClick={() => requestMedia('downloadMidi')}
                className='btn__fun midi__download'
              >Download Midi
              </button>
            </div>
          </div>
        </div>
      </>
    );
  } else {
    return (
      <>
        <div className='content'>
          <div className='header__div'>
            <h2 className='header__title'>MS Downloader</h2>
          </div>
          <div className='message__div'>
            <p className='message__text'>{messageState.message}</p>
            {
              messageState.loading &&
              <pre ref={loadingRef} className='message__loading'></pre>
            }
            {
              showSingleBtb &&
              <div className='fun__content'>
                <button className='btn__fun btn__single' onClick={handleSingleBtn}>{singleBtbText}</button>
              </div>
            }
          </div>
        </div>
      </>
    );
  }
}
