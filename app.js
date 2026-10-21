(() => {
  "use strict";

  const containers = Object.freeze({ "091": "血ガス容器", "518": "PN2", "007": "尿コップ" });
  const classToContainer = Object.freeze({ "血ガス容器": "血ガス容器", "PN2": "PN2", "尿コップ": "尿コップ" });
  const barcode1 = document.getElementById("barcode1");
  const barcodeForm = document.getElementById("barcodeForm");
  const barcodeStatus = document.getElementById("barcodeStatus");
  const barcodeDebug = document.getElementById("barcodeDebug");
  const camera = document.getElementById("camera");
  const cameraPlaceholder = document.getElementById("cameraPlaceholder");
  const snapshot = document.getElementById("snapshot");
  const startCameraButton = document.getElementById("startCamera");
  const captureButton = document.getElementById("captureButton");
  const stopCameraButton = document.getElementById("stopCamera");
  const imageStatus = document.getElementById("imageStatus");
  const predictions = document.getElementById("predictions");
  const finalResult = document.getElementById("finalResult");
  const modelUrlInput = document.getElementById("modelUrl");
  const loadModelButton = document.getElementById("loadModel");
  const modelStatus = document.getElementById("modelStatus");

  let stream = null, model = null, barcodeContainer = null, imageContainer = null;
  const MIN_CONFIDENCE = 0.75;

  function lastThreeDigits(value) {
    const digits = String(value ?? "").replace(/\D/g, "");
    return digits.length >= 3 ? digits.slice(-3) : "";
  }
  function setStatus(el, message, type = "neutral") { el.textContent = message; el.className = `status ${type}`; }
  function setFinal(message, type = "neutral") { finalResult.textContent = message; finalResult.className = `final-result ${type}`; }

  function checkBarcode(event) {
    if (event) event.preventDefault();
    const raw = barcode1.value.trim();
    const code = lastThreeDigits(raw);
    imageContainer = null;
    predictions.innerHTML = "";
    if (!raw || !code) {
      barcodeContainer = null;
      barcodeDebug.textContent = "読み取った末尾3桁がここに表示されます。";
      setStatus(barcodeStatus, "バーコード①を読み取ってください。", "warning");
      setFinal("バーコード①を読み取ってください。", "warning");
      barcode1.focus();
      return;
    }
    barcodeDebug.textContent = `①末尾：${code}`;
    barcodeContainer = containers[code] || null;
    if (!barcodeContainer) {
      setStatus(barcodeStatus, `登録されていないコードです（${code}）。バーコードを確認してください。`, "error");
      setFinal("対象外のバーコードです。画像との照合はできません。", "error");
      return;
    }
    setStatus(barcodeStatus, `バーコード①：${barcodeContainer}`, "success");
    setFinal(`バーコード①は「${barcodeContainer}」です。カメラで容器を撮影してください。`, "neutral");
  }
  barcodeForm.addEventListener("submit", checkBarcode);
  barcode1.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); checkBarcode(); }
  });
  barcode1.addEventListener("input", () => {
    barcodeContainer = null; imageContainer = null;
    setFinal("バーコード①を確認し、画像を撮影してください。", "neutral");
  });

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus(imageStatus, "カメラを利用できません。HTTPSまたはlocalhostで開いてください。", "error"); return;
    }
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      camera.srcObject = stream; await camera.play(); cameraPlaceholder.hidden = true;
      startCameraButton.disabled = true; captureButton.disabled = false; stopCameraButton.disabled = false;
      setStatus(imageStatus, "カメラ起動中です。容器全体を映して撮影してください。", "success");
    } catch (error) {
      console.error(error);
      setStatus(imageStatus, "カメラを起動できません。ブラウザのカメラ使用許可とHTTPS接続を確認してください。", "error");
    }
  }
  function stopCamera() {
    if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    camera.srcObject = null; cameraPlaceholder.hidden = false;
    startCameraButton.disabled = false; captureButton.disabled = true; stopCameraButton.disabled = true;
  }
  async function loadModel() {
    const baseUrl = modelUrlInput.value.trim();
    if (!baseUrl) { setStatus(modelStatus, "先にTeachable MachineのモデルURLを入力してください。", "warning"); return; }
    if (!window.tmImage) { setStatus(modelStatus, "画像判定ライブラリを読み込めません。インターネット接続を確認してください。", "error"); return; }
    const normalizedUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    loadModelButton.disabled = true; setStatus(modelStatus, "モデルを読み込んでいます…");
    try {
      model = await tmImage.load(`${normalizedUrl}model.json`, `${normalizedUrl}metadata.json`);
      const classNames = model.getClassLabels();
      const missing = Object.keys(classToContainer).filter(name => !classNames.includes(name));
      setStatus(modelStatus, missing.length
        ? `モデル読み込み済みですが、必要なクラス名がありません：${missing.join("、")}。モデルのクラス名を確認してください。現在：${classNames.join("、")}`
        : `モデル読み込み完了：${classNames.join("・")}`, missing.length ? "warning" : "success");
    } catch (error) {
      console.error(error); model = null;
      setStatus(modelStatus, "モデルを読み込めません。モデルURLと公開設定を確認してください。", "error");
    } finally { loadModelButton.disabled = false; }
  }
  async function captureAndPredict() {
    if (!barcodeContainer) {
      setStatus(imageStatus, "先にバーコード①を読み取り、「バーコード①を確認」を押してください。", "warning");
      setFinal("先にバーコード①を確認してください。", "warning"); return;
    }
    if (!camera.videoWidth || !camera.videoHeight) {
      setStatus(imageStatus, "カメラ映像が準備できていません。少し待ってから再度押してください。", "warning"); return;
    }
    snapshot.width = camera.videoWidth; snapshot.height = camera.videoHeight;
    snapshot.getContext("2d").drawImage(camera, 0, 0, snapshot.width, snapshot.height); snapshot.hidden = false;
    if (!model) {
      imageContainer = null; setStatus(imageStatus, "撮影しましたが、AIモデルが未設定のため判定できません。モデルURLを設定してください。", "warning");
      updateFinalResult(); return;
    }
    captureButton.disabled = true; setStatus(imageStatus, "画像を判定しています…");
    try {
      const results = await model.predict(snapshot); results.sort((a, b) => b.probability - a.probability);
      const best = results[0]; imageContainer = best ? (classToContainer[best.className] || null) : null;
      predictions.innerHTML = "";
      results.forEach(item => {
        const row = document.createElement("div"); row.className = "prediction-row";
        const label = document.createElement("span"); label.textContent = item.className;
        const percent = document.createElement("strong"); percent.textContent = `${(item.probability * 100).toFixed(1)}%`;
        const bar = document.createElement("div"); bar.className = "bar";
        const fill = document.createElement("div"); fill.className = "bar-fill";
        fill.style.width = `${Math.max(0, Math.min(100, item.probability * 100))}%`; bar.appendChild(fill); row.append(label, percent, bar); predictions.appendChild(row);
      });
      if (!best || best.probability < MIN_CONFIDENCE || !imageContainer) {
        imageContainer = null; setStatus(imageStatus, `判定保留：信頼度が基準（${Math.round(MIN_CONFIDENCE * 100)}%）未満、または未登録クラスです。撮影し直してください。`, "warning");
      } else setStatus(imageStatus, `画像判定：${imageContainer}（信頼度 ${(best.probability * 100).toFixed(1)}%）`, "success");
      updateFinalResult();
    } catch (error) {
      console.error(error); imageContainer = null;
      setStatus(imageStatus, "画像判定に失敗しました。モデルのクラス名とURLを確認してください。", "error"); updateFinalResult();
    } finally { captureButton.disabled = false; }
  }
  function updateFinalResult() {
    if (!barcodeContainer) { setFinal("先にバーコード①を確認してください。", "warning"); return; }
    if (!imageContainer) { setFinal(`バーコード①：${barcodeContainer}\n画像判定が完了すると照合結果が表示されます。`, "neutral"); return; }
    if (barcodeContainer === imageContainer) {
      setFinal(`〇 判定一致\nバーコード①：${barcodeContainer}\n画像判定：${imageContainer}\n※最終確認は施設の手順に従ってください。`, "success");
    } else {
      setFinal(`× 判定不一致\nバーコード①：${barcodeContainer}\n画像判定：${imageContainer}\n容器を確認し、運用手順に従ってください。`, "error");
    }
  }
  startCameraButton.addEventListener("click", startCamera);
  stopCameraButton.addEventListener("click", stopCamera);
  captureButton.addEventListener("click", captureAndPredict);
  loadModelButton.addEventListener("click", loadModel);
  // Preconfigured Teachable Machine model URL; load automatically on page open.
  modelUrlInput.value = "https://teachablemachine.withgoogle.com/models/GWbRVGZwk/";
  loadModel();
  barcode1.focus(); window.addEventListener("beforeunload", stopCamera);
})();
