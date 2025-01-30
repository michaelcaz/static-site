const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

// Configure paths
const CONTENT_DIR = path.join(__dirname, '../src/content');
const TEMPLATE_DIR = path.join(__dirname, '../src/templates');
const STATIC_DIR = path.join(__dirname, '../src/static');
const OUTPUT_DIR = path.join(__dirname, '../dist');

// Read and parse template
async function readTemplate(templateName) {
    const templatePath = path.join(TEMPLATE_DIR, templateName);
    return await fs.readFile(templatePath, 'utf-8');
}

// Process markdown files
async function processMarkdown(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const { attributes, body } = frontMatter(content);
    const html = marked(body);
    return { attributes, html };
}

// Apply template
function applyTemplate(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
}

async function processPages() {
    // Read base template
    const baseTemplate = await readTemplate('base.html');

    // Process pages
    const pagesDir = path.join(CONTENT_DIR, 'pages');
    const pages = await fs.readdir(pagesDir);

    for (const page of pages) {
        if (page.endsWith('.md')) {
            const { attributes, html } = await processMarkdown(path.join(pagesDir, page));
            const finalHtml = applyTemplate(baseTemplate, {
                title: attributes.title || 'Untitled',
                content: html
            });

            const outputPath = path.join(
                OUTPUT_DIR, 
                page.replace('.md', '.html')
            );
            await fs.outputFile(outputPath, finalHtml);
        }
    }
}

async function processBlogPosts() {
    const blogDir = path.join(CONTENT_DIR, 'blog');
    const blogTemplate = await readTemplate('blog.html');
    const posts = await fs.readdir(blogDir);
    
    // Store post metadata for the index page
    const postsList = [];

    for (const post of posts) {
        if (post.endsWith('.md')) {
            const { attributes, html } = await processMarkdown(path.join(blogDir, post));
            
            // Add to posts list
            postsList.push({
                title: attributes.title,
                date: attributes.date,
                author: attributes.author,
                slug: post.replace('.md', ''),
                excerpt: attributes.excerpt || html.split('\n')[0]
            });

            // Generate individual post page
            const finalHtml = applyTemplate(blogTemplate, {
                title: attributes.title,
                date: attributes.date,
                author: attributes.author || '',
                content: html
            });

            const outputPath = path.join(
                OUTPUT_DIR,
                'blog',
                post.replace('.md', '.html')
            );
            await fs.outputFile(outputPath, finalHtml);
        }
    }

    // Sort posts by date
    postsList.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Generate blog index page
    const blogIndexHtml = generateBlogIndex(postsList);
    const baseTemplate = await readTemplate('base.html');
    const finalIndexHtml = applyTemplate(baseTemplate, {
        title: 'Blog',
        content: blogIndexHtml
    });

    await fs.outputFile(path.join(OUTPUT_DIR, 'blog', 'index.html'), finalIndexHtml);
}

function generateBlogIndex(posts) {
    return `
        <h1>Blog Posts</h1>
        <div class="posts-list">
            ${posts.map(post => `
                <article class="post-preview">
                    <h2><a href="/blog/${post.slug}.html">${post.title}</a></h2>
                    <div class="meta">
                        <time>${post.date}</time>
                        ${post.author ? `<span class="author">by ${post.author}</span>` : ''}
                    </div>
                    <p>${post.excerpt}</p>
                    <a href="/blog/${post.slug}.html" class="read-more">Read more →</a>
                </article>
            `).join('\n')}
        </div>
    `;
}

async function build() {
    try {
        // Clean and recreate output directory
        await fs.emptyDir(OUTPUT_DIR);

        // Copy static files
        await fs.copy(STATIC_DIR, OUTPUT_DIR);

        // Process regular pages
        await processPages();

        // Process blog posts
        await processBlogPosts();

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
    }
}

build(); 