const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// 配置multer用于文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('只允许上传PDF文件'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    }
});

// 路由：主页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 路由：上传PDF文件
app.post('/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请选择PDF文件' });
        }

        const fileInfo = {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: req.file.path,
            uploadTime: new Date().toISOString()
        };

        res.json({
            success: true,
            message: '文件上传成功',
            file: fileInfo
        });
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({ error: '文件上传失败' });
    }
});

// 路由：获取PDF文件列表
app.get('/files', async (req, res) => {
    try {
        const files = await fs.readdir('uploads');
        const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');
        
        const fileList = await Promise.all(pdfFiles.map(async (filename) => {
            const filePath = path.join('uploads', filename);
            const stats = await fs.stat(filePath);
            return {
                filename,
                size: stats.size,
                uploadTime: stats.birthtime.toISOString()
            };
        }));

        res.json({ files: fileList });
    } catch (error) {
        console.error('获取文件列表错误:', error);
        res.status(500).json({ error: '获取文件列表失败' });
    }
});

// 路由：添加水印到PDF
app.post('/add-watermark', async (req, res) => {
    try {
        const { filename, watermarkText, position = 'center', opacity = 0.3 } = req.body;
        
        if (!filename || !watermarkText) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const inputPath = path.join('uploads', filename);
        const outputFilename = `watermarked-${Date.now()}-${filename}`;
        const outputPath = path.join('uploads', outputFilename);

        // 检查输入文件是否存在
        if (!await fs.pathExists(inputPath)) {
            return res.status(404).json({ error: '文件不存在' });
        }

        // 读取PDF文件
        const existingPdfBytes = await fs.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        
        // 获取字体
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        
        // 获取所有页面
        const pages = pdfDoc.getPages();
        
        // 为每页添加水印
        pages.forEach(page => {
            const { width, height } = page.getSize();
            const fontSize = Math.min(width, height) * 0.05; // 动态字体大小
            
            // 计算水印位置
            let x, y;
            switch (position) {
                case 'top-left':
                    x = 50;
                    y = height - 50;
                    break;
                case 'top-right':
                    x = width - 200;
                    y = height - 50;
                    break;
                case 'bottom-left':
                    x = 50;
                    y = 50;
                    break;
                case 'bottom-right':
                    x = width - 200;
                    y = 50;
                    break;
                case 'center':
                default:
                    x = width / 2 - 100;
                    y = height / 2;
                    break;
            }
            
            // 添加水印文本
            page.drawText(watermarkText, {
                x,
                y,
                size: fontSize,
                font,
                color: rgb(0.5, 0.5, 0.5),
                opacity: parseFloat(opacity),
                rotate: { angle: Math.PI / 6 } // 30度倾斜
            });
        });

        // 保存新的PDF
        const pdfBytes = await pdfDoc.save();
        await fs.writeFile(outputPath, pdfBytes);

        res.json({
            success: true,
            message: '水印添加成功',
            filename: outputFilename,
            originalFilename: filename
        });

    } catch (error) {
        console.error('添加水印错误:', error);
        res.status(500).json({ error: '添加水印失败: ' + error.message });
    }
});

// 路由：删除文件
app.delete('/files/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join('uploads', filename);
        
        if (await fs.pathExists(filePath)) {
            await fs.remove(filePath);
            res.json({ success: true, message: '文件删除成功' });
        } else {
            res.status(404).json({ error: '文件不存在' });
        }
    } catch (error) {
        console.error('删除文件错误:', error);
        res.status(500).json({ error: '删除文件失败' });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '文件大小超过限制(10MB)' });
        }
    }
    console.error(error);
    res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('PDF预览和水印系统已启动');
});

module.exports = app;