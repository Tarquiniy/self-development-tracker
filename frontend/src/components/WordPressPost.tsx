import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiService } from '../services/api';

const WordPressPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [headContent, setHeadContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPostHtml = async () => {
      if (!slug) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || 'https://sdracker.onrender.com'}api/blog/wordpress/post/${slug}/html/`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch post: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update page title
        if (data.title) {
          document.title = data.title;
        }
        
        setHtmlContent(data.html || '');
        setHeadContent(data.head || '');
        
      } catch (err) {
        console.error('Error fetching WordPress post:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPostHtml();
  }, [slug]);

  // Function to isolate and handle the content area
  const extractContent = (fullHtml: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullHtml, 'text/html');
    
    // Try to find our specific content container
    const contentElement = doc.getElementById('cs-rendered-content');
    if (contentElement) {
      return contentElement.innerHTML;
    }
    
    // Fallback: try to find common content containers
    const possibleContainers = [
      doc.querySelector('.entry-content'),
      doc.querySelector('.post-content'),
      doc.querySelector('#content'),
      doc.querySelector('main'),
      doc.querySelector('article')
    ];
    
    for (const container of possibleContainers) {
      if (container) {
        return container.innerHTML;
      }
    }
    
    // Ultimate fallback: return body content
    return doc.body.innerHTML;
  };

  if (loading) {
    return (
      <div className="container">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div style={{ padding: '2rem', color: 'crimson' }}>
          <h2>Ошибка загрузки</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wordpress-post-container">
      {/* Inject head content (styles, etc.) */}
      {headContent && (
        <div dangerouslySetInnerHTML={{ __html: headContent }} />
      )}
      
      {/* Main content */}
      <div 
        className="wordpress-post-content"
        dangerouslySetInnerHTML={{ __html: extractContent(htmlContent) }} 
      />
      
      {/* Fix any URL paths that might be broken */}
      <script dangerouslySetInnerHTML={{
        __html: `
          document.addEventListener('DOMContentLoaded', function() {
            // Fix image URLs
            const images = document.querySelectorAll('img');
            images.forEach(img => {
              if (img.src.includes('cs88500-wordpress-o0a99.tw1.ru')) {
                // Ensure proper protocol
                img.src = img.src.replace(/^http:/, 'https:');
              }
            });
            
            // Fix anchor links to open in new tab if they point away from our site
            const links = document.querySelectorAll('a');
            links.forEach(link => {
              if (link.hostname !== window.location.hostname && 
                  link.hostname !== 'cs88500-wordpress-o0a99.tw1.ru') {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
              }
            });
          });
        `
      }} />
    </div>
  );
};

export default WordPressPost;