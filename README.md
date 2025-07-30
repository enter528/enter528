# PDF在线预览与水印系统

一个基于Node.js和Express的PDF文档在线预览和水印添加系统，支持PDF文件上传、在线预览、添加自定义水印等功能。

## ✨ 功能特性

- 📁 **PDF文件上传** - 支持拖拽上传和点击选择，最大支持10MB文件
- 👀 **PDF在线预览** - 基于PDF.js实现高质量PDF预览
- 📄 **页面导航** - 支持翻页、缩放等操作
- 🎨 **水印添加** - 可自定义水印文本、位置和透明度
- 📱 **响应式设计** - 支持桌面和移动设备
- ⌨️ **键盘快捷键** - 支持方向键翻页、+/-缩放
- 🗑️ **文件管理** - 支持文件删除和列表查看

## 🚀 快速开始

### 环境要求

- Node.js 14.0 或更高版本
- npm 或 yarn

### 安装步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd pdf-preview-watermark
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动服务器**
   ```bash
   npm start
   ```

4. **访问应用**
   打开浏览器访问 `http://localhost:3000`

### 开发模式

```bash
npm run dev
```

## 📖 使用说明

### 1. 上传PDF文件

- **方式一**：点击"选择文件"按钮选择PDF文件
- **方式二**：直接拖拽PDF文件到上传区域
- 支持的文件格式：`.pdf`
- 文件大小限制：最大10MB

### 2. 预览PDF

- 在文件列表中点击"预览"按钮
- 使用控制按钮进行翻页和缩放
- 支持键盘快捷键：
  - `←` `→` 翻页
  - `+` `-` 缩放

### 3. 添加水印

1. 选择要添加水印的PDF文件并预览
2. 在水印设置区域输入水印文本
3. 选择水印位置（居中、四个角）
4. 调整透明度（10%-100%）
5. 点击"添加水印"按钮

### 4. 文件管理

- 查看已上传的文件列表
- 删除不需要的文件
- 文件信息包括大小和上传时间

## 🛠️ 技术栈

### 后端
- **Express** - Web框架
- **Multer** - 文件上传处理
- **pdf-lib** - PDF处理和水印添加
- **fs-extra** - 文件系统操作

### 前端
- **PDF.js** - PDF渲染和预览
- **HTML5 Canvas** - PDF页面渲染
- **Vanilla JavaScript** - 前端交互逻辑
- **CSS3** - 现代化UI设计
- **Font Awesome** - 图标库

## 📁 项目结构

```
pdf-preview-watermark/
├── server.js              # 服务器主文件
├── package.json           # 项目配置
├── public/                # 静态资源
│   ├── index.html        # 主页面
│   ├── css/
│   │   └── style.css     # 样式文件
│   └── js/
│       └── app.js        # 前端逻辑
├── uploads/              # 上传文件存储目录
└── README.md            # 项目说明
```

## 🔧 API接口

### 上传文件
```
POST /upload
Content-Type: multipart/form-data
Body: pdf文件
```

### 获取文件列表
```
GET /files
Response: { files: [...] }
```

### 添加水印
```
POST /add-watermark
Content-Type: application/json
Body: {
  filename: string,
  watermarkText: string,
  position: string,
  opacity: number
}
```

### 删除文件
```
DELETE /files/:filename
```

## ⚙️ 配置选项

### 服务器配置
- 端口：默认3000，可通过环境变量`PORT`修改
- 文件大小限制：10MB（可在server.js中修改）
- 支持的文件类型：PDF（可扩展）

### 水印配置
- 支持位置：center, top-left, top-right, bottom-left, bottom-right
- 透明度范围：0.1 - 1.0
- 字体：Helvetica（可扩展）
- 倾斜角度：30度（可自定义）

## 🔒 安全考虑

- 文件类型验证
- 文件大小限制
- 文件名唯一性处理
- 错误处理和用户反馈

## 🐛 故障排除

### 常见问题

1. **服务器启动失败**
   - 检查端口是否被占用
   - 确认Node.js版本是否符合要求

2. **文件上传失败**
   - 检查文件格式是否为PDF
   - 确认文件大小不超过10MB

3. **PDF预览失败**
   - 检查PDF文件是否损坏
   - 确认浏览器支持PDF.js

4. **水印添加失败**
   - 检查水印文本是否为空
   - 确认PDF文件是否存在

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📞 联系方式

如有问题或建议，请联系：enter528

---

⭐ 如果这个项目对你有帮助，请给个Star支持一下！
