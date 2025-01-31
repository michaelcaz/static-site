const fs = require('fs-extra');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

// Configure paths
const CONTENT_DIR = path.join(__dirname, '../src/content');
const TEMPLATE_DIR = path.join(__dirname, '../src/templates');
const STATIC_DIR = path.join(__dirname, '../src/static');
const OUTPUT_DIR = path.join(__dirname, '../docs');

// Read and parse template
async function readTemplate(templateName) {
    const templatePath = path.join(TEMPLATE_DIR, templateName);
    return await fs.readFile(templatePath, 'utf-8');
}

// Process markdown files
async function processMarkdown(filePath) {
    console.log('Reading file:', filePath);
    const content = await fs.readFile(filePath, 'utf-8');
    console.log('Raw content:', content);
    const { attributes, body } = frontMatter(content);
    console.log('Parsed frontmatter:', { attributes, body });
    const html = marked(body);
    console.log('Generated HTML:', html);
    return { attributes, html };
}

// Apply template
function applyTemplate(template, data) {
    let result = template;
    
    // Handle conditionals first
    result = result.replace(/{{#if (\w+)}}(.*?){{\/if}}/gs, (match, key, content) => {
        return data[key] ? content : '';
    });
    
    // Handle each loops
    result = result.replace(/{{#each (\w+)}}(.*?){{\/each}}/gs, (match, key, content) => {
        if (!Array.isArray(data[key])) return '';
        return data[key].map(item => {
            let itemContent = content;
            // Replace variables within the each block
            for (const [itemKey, itemValue] of Object.entries(item)) {
                itemContent = itemContent.replace(
                    new RegExp(`{{${itemKey}}}`, 'g'),
                    itemValue
                );
            }
            return itemContent;
        }).join('\n');
    });
    
    // Handle regular variables
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' || typeof value === 'number') {
            result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
    }
    
    return result;
}

async function processPages() {
    console.log('Starting page processing...');
    // Read base template
    const baseTemplate = await readTemplate('base.html');
    console.log('Loaded base template');

    // Process pages
    const pagesDir = path.join(CONTENT_DIR, 'pages');
    const pages = await fs.readdir(pagesDir);
    console.log('Found pages:', pages);
    
    for (const page of pages) {
        if (page.endsWith('.md')) {
            console.log('\nProcessing:', page);
            const fullPath = path.join(pagesDir, page);
            const { attributes, html } = await processMarkdown(fullPath);
            console.log('Final data:', { attributes, html });
            
            const finalHtml = applyTemplate(baseTemplate, {
                title: attributes.title || 'Untitled',
                content: html
            });

            const outputPath = path.join(
                OUTPUT_DIR, 
                page.replace('.md', '.html')
            );
            console.log('Writing to:', outputPath);
            await fs.outputFile(outputPath, finalHtml);
        }
    }
}

async function processBlogPosts() {
    console.log('Processing blog posts...');
    const blogDir = path.join(CONTENT_DIR, 'blog');
    const outputBlogDir = path.join(OUTPUT_DIR, 'blog');
    
    // Create blog directory if it doesn't exist
    await fs.ensureDir(outputBlogDir);
    
    // Read blog post template
    const blogPostTemplate = await readTemplate('blog-post.html');
    
    // Get all markdown files
    const posts = [];
    const files = await fs.readdir(blogDir);
    
    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        
        const filePath = path.join(blogDir, file);
        const { attributes, html } = await processMarkdown(filePath);
        
        // Generate URL-friendly slug from filename
        const slug = path.basename(file, '.md');
        const url = `${slug}.html`;
        
        // Format the date
        const date = new Date(attributes.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        // Add to posts array for index generation
        posts.push({
            ...attributes,
            url,
            content: html,
            date: formattedDate
        });
        
        // Apply blog post template
        const postHtml = applyTemplate(blogPostTemplate, {
            ...attributes,
            content: html,
            date: formattedDate
        });
        
        // Write blog post HTML
        await fs.writeFile(
            path.join(outputBlogDir, `${slug}.html`),
            postHtml
        );
    }
    
    // Sort posts by date
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Generate blog index
    await generateBlogIndex(posts);
}

async function generateBlogIndex(posts) {
    console.log('Generating blog index...');
    const blogIndexTemplate = await readTemplate('blog-index.html');
    
    const indexHtml = applyTemplate(blogIndexTemplate, {
        posts: posts.map(post => ({
            ...post,
            date: new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        }))
    });
    
    await fs.writeFile(
        path.join(OUTPUT_DIR, 'blog/index.html'),
        indexHtml
    );
}

async function build() {
    try {
        // Clear output directory
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
        process.exit(1);
    }
}

build(); 