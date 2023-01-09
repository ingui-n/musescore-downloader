import React, {useEffect, useRef, useState} from 'react';
import browser from 'webextension-polyfill';
import './popup.css';
import {
  messages,
  isConnectionOk,
  isMuseScoreUrl,
  isScoreUrl,
  resetBgColorAnimation,
  setLoadingAnimation,
  updateCurrentTab,
} from '../modules/utils';

const Popup = () => {
  const [showContent, setShowContent] = useState(false);
  const [currentTab, setCurrentTab] = useState(null);
  const [showRefreshBtb, setShowRefreshBtb] = useState(false);
  const [message, setMessage] = useState(messages.initializing);
  const loadingRef = useRef(null);

  useEffect(() => {
    (async () => {
      const curr = await updateCurrentTab();
      setCurrentTab(curr);

      if (curr.status === 'complete')
        return;

      const tabListenerHandler = async (tabId, changeInfo) => {
        if (tabId === curr.id && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(tabListenerHandler);
          setCurrentTab(await updateCurrentTab());
        }
      };

      browser.tabs.onUpdated.addListener(tabListenerHandler);
    })();
  }, []);

  useEffect(() => {
    if (currentTab) {
      initContent().catch(() => {
        showMessage('unknownError');
      });
    }
  }, [currentTab]);

  const initContent = async () => {
    showMessage('pageLoading');

    if (currentTab.status !== 'complete')
      return;

    if (!currentTab.url) {
      showMessage('badPage');
      return;
    }

    if (!isMuseScoreUrl(currentTab.url)) {
      showMessage('badPage');
      return;
    }

    if (!(await isConnectionOk(currentTab.id))) {
      showMessage('noConnection');
      return;
    }

    if (!isScoreUrl(currentTab.url)) {
      const isScorePage = await browser.tabs.sendMessage(currentTab.id, 'isScorePage');

      if (!isScorePage) {
        showMessage('cannotDetect');
        return;
      }
    }

    setShowContent(true);
    resetBgColorAnimation();
  };

  const showMessage = (type) => {
    if (!messages[type])
      return;

    setShowContent(false);
    setMessage(messages[type]);

    if (messages[type].loading)
      setLoadingAnimation(loadingRef);

    setShowRefreshBtb(type === 'noConnection');
    resetBgColorAnimation();
  };

  const requestMedia = async (type, label) => {
    showMessage('sendingRequest');
    await browser.tabs.sendMessage(currentTab.id, {type, label});

    browser.runtime.onMessage.addListener(request => {
      if (messages[request])
        showMessage(request);
    });
  };

  const refreshPages = () => {
    browser.tabs.reload();
    window.location.reload();
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
                onClick={() => requestMedia('img', 'openSheet')}
                className='btn__fun sheet__open'
              >Open Sheet
              </button>
              <button
                onClick={() => requestMedia('img', 'downloadSheet')}
                className='btn__fun sheet__download'
              >Download Sheet
              </button>
            </div>
            <div>
              <button
                onClick={() => requestMedia('mp3', 'downloadAudio')}
                className='btn__fun audio__download'
              >Download Audio
              </button>
              <button
                onClick={() => requestMedia('midi', 'downloadMidi')}
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
            <p className='message__text'>{message.message}</p>
            {
              message.loading &&
              <pre ref={loadingRef} className='message__loading'></pre>
            }
            {
              showRefreshBtb &&
              <div className='fun__content'>
                <button className='btn__fun btn__refresh' onClick={refreshPages}>Refresh</button>
              </div>
            }
          </div>
        </div>
      </>
    );
  }
};

export default Popup;
