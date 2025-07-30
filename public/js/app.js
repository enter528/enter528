// 全局变量
let currentPdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.0;
let currentFileName = '';

// DOM元素
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const filesContainer = document.getElementById('filesContainer');
const previewSection = document.getElementById('previewSection');
const watermarkSection = document.getElementById('watermarkSection');
const pdfCanvas = document.getElementById('pdfCanvas');
const pageInfo = document.getElementById('pageInfo');
const zoomInfo = document.getElementById('zoomInfo');
const message = document.getElementById('message');
const loading = document.getElementById('loading');

// 页面控制按钮
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

// 水印控件
const watermarkText = document.getElementById('watermarkText');
const watermarkPosition = document.getElementById('watermarkPosition');
const watermarkOpacity = document.getElementById('watermarkOpacity');
const opacityValue = document.getElementById('opacityValue');
const addWatermarkBtn = document.getElementById('addWatermarkBtn');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadFileList();
    
    // 配置PDF.js
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
});

// 初始化事件监听器
function initializeEventListeners() {
    // 文件上传相关
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);

    // PDF预览控制
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));
    zoomInBtn.addEventListener('click', () => changeZoom(0.1));
    zoomOutBtn.addEventListener('click', () => changeZoom(-0.1));

    // 水印相关
    watermarkOpacity.addEventListener('input', updateOpacityDisplay);
    addWatermarkBtn.addEventListener('click', addWatermark);
}

// 拖拽处理
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        fileInput.files = files;
        handleFileSelect({ target: { files: files } });
    } else {
        showMessage('请选择PDF文件', 'error');
    }
}

// 文件选择处理
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        showMessage('请选择PDF文件', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showMessage('文件大小不能超过10MB', 'error');
        return;
    }

    uploadFile(file);
}

// 上传文件
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('pdf', file);

    try {
        showProgress();
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        hideProgress();

        const result = await response.json();
        
        if (result.success) {
            showMessage('文件上传成功', 'success');
            loadFileList();
            fileInput.value = '';
        } else {
            showMessage(result.error || '上传失败', 'error');
        }
    } catch (error) {
        hideProgress();
        console.error('上传错误:', error);
        showMessage('上传失败，请重试', 'error');
    }
}

// 加载文件列表
async function loadFileList() {
    try {
        const response = await fetch('/files');
        const result = await response.json();
        
        displayFileList(result.files || []);
    } catch (error) {
        console.error('获取文件列表错误:', error);
        showMessage('获取文件列表失败', 'error');
    }
}

// 显示文件列表
function displayFileList(files) {
    if (files.length === 0) {
        filesContainer.innerHTML = '<p class="no-files">暂无上传的PDF文件</p>';
        return;
    }

    const fileItems = files.map(file => {
        const fileSize = formatFileSize(file.size);
        const uploadTime = new Date(file.uploadTime).toLocaleString('zh-CN');
        
        return `
            <div class="file-item">
                <div class="file-info">
                    <div class="file-icon">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="file-details">
                        <h3>${file.filename}</h3>
                        <p>大小: ${fileSize} | 上传时间: ${uploadTime}</p>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn btn-primary" onclick="previewPdf('${file.filename}')">
                        <i class="fas fa-eye"></i> 预览
                    </button>
                    <button class="btn btn-danger" onclick="deleteFile('${file.filename}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </div>
        `;
    }).join('');

    filesContainer.innerHTML = fileItems;
}

// 预览PDF
async function previewPdf(filename) {
    try {
        showLoading();
        currentFileName = filename;
        
        const url = `/uploads/${filename}`;
        const loadingTask = pdfjsLib.getDocument(url);
        currentPdf = await loadingTask.promise;
        totalPages = currentPdf.numPages;
        currentPage = 1;
        
        await renderPage(currentPage);
        
        previewSection.style.display = 'block';
        watermarkSection.style.display = 'block';
        
        updatePageInfo();
        hideLoading();
        
        // 滚动到预览区域
        previewSection.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        hideLoading();
        console.error('PDF预览错误:', error);
        showMessage('PDF预览失败', 'error');
    }
}

// 渲染PDF页面
async function renderPage(pageNum) {
    if (!currentPdf) return;
    
    try {
        const page = await currentPdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale });
        
        const context = pdfCanvas.getContext('2d');
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
    } catch (error) {
        console.error('渲染页面错误:', error);
        showMessage('页面渲染失败', 'error');
    }
}

// 切换页面
function changePage(delta) {
    if (!currentPdf) return;
    
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderPage(currentPage);
        updatePageInfo();
    }
}

// 缩放控制
function changeZoom(delta) {
    const newScale = scale + delta;
    if (newScale >= 0.5 && newScale <= 3.0) {
        scale = newScale;
        renderPage(currentPage);
        updateZoomInfo();
    }
}

// 更新页面信息
function updatePageInfo() {
    pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

// 更新缩放信息
function updateZoomInfo() {
    zoomInfo.textContent = `${Math.round(scale * 100)}%`;
}

// 更新透明度显示
function updateOpacityDisplay() {
    const value = Math.round(watermarkOpacity.value * 100);
    opacityValue.textContent = `${value}%`;
}

// 添加水印
async function addWatermark() {
    if (!currentFileName) {
        showMessage('请先选择要添加水印的PDF文件', 'error');
        return;
    }

    const text = watermarkText.value.trim();
    if (!text) {
        showMessage('请输入水印文本', 'error');
        return;
    }

    try {
        showLoading();
        
        const response = await fetch('/add-watermark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: currentFileName,
                watermarkText: text,
                position: watermarkPosition.value,
                opacity: watermarkOpacity.value
            })
        });

        const result = await response.json();
        hideLoading();

        if (result.success) {
            showMessage('水印添加成功', 'success');
            loadFileList();
            
            // 预览新生成的文件
            setTimeout(() => {
                previewPdf(result.filename);
            }, 1000);
        } else {
            showMessage(result.error || '添加水印失败', 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('添加水印错误:', error);
        showMessage('添加水印失败，请重试', 'error');
    }
}

// 删除文件
async function deleteFile(filename) {
    if (!confirm('确定要删除这个文件吗？')) {
        return;
    }

    try {
        const response = await fetch(`/files/${filename}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (result.success) {
            showMessage('文件删除成功', 'success');
            loadFileList();
            
            // 如果删除的是当前预览的文件，隐藏预览区域
            if (filename === currentFileName) {
                previewSection.style.display = 'none';
                watermarkSection.style.display = 'none';
                currentFileName = '';
                currentPdf = null;
            }
        } else {
            showMessage(result.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除文件错误:', error);
        showMessage('删除失败，请重试', 'error');
    }
}

// 工具函数
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showMessage(text, type = 'info') {
    message.textContent = text;
    message.className = `message ${type} show`;
    
    setTimeout(() => {
        message.classList.remove('show');
    }, 3000);
}

function showProgress() {
    uploadProgress.style.display = 'block';
    
    // 模拟进度
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
        }
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    }, 200);
}

function hideProgress() {
    setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
    }, 500);
}

function showLoading() {
    loading.style.display = 'flex';
}

function hideLoading() {
    loading.style.display = 'none';
}

// 键盘快捷键
document.addEventListener('keydown', function(e) {
    if (!currentPdf) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            e.preventDefault();
            changePage(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            changePage(1);
            break;
        case '+':
        case '=':
            e.preventDefault();
            changeZoom(0.1);
            break;
        case '-':
            e.preventDefault();
            changeZoom(-0.1);
            break;
    }
});