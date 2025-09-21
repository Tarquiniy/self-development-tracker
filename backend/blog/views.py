import requests
from django.http import HttpResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt

@require_GET
@csrf_exempt
def wordpress_post_html(request, slug):
    # Получаем данные поста из WordPress API
    wp_url = f"https://cs88500-wordpress-o0a99.tw1.ru/wp-json/wp/v2/posts?slug={slug}&_embed"
    try:
        resp = requests.get(wp_url, timeout=10)
    except requests.RequestException as e:
        return HttpResponse(f"Failed to fetch from WordPress: {str(e)}", status=502)

    if resp.status_code != 200:
        return HttpResponse(f"WordPress returned error: {resp.status_code}", status=resp.status_code)

    data = resp.json()
    if not data:
        return HttpResponse("Post not found", status=404)

    post = data[0]
    content = post.get('content', {}).get('rendered', '')
    title = post.get('title', {}).get('rendered', '')

    # Получаем CSS стили из заголовка WordPress
    wp_home_url = "https://cs88500-wordpress-o0a99.tw1.ru"
    try:
        home_resp = requests.get(wp_home_url, timeout=10)
        stylesheets = []
        if home_resp.status_code == 200:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(home_resp.text, 'html.parser')
            for link in soup.find_all('link', rel='stylesheet'):
                href = link.get('href')
                if href and 'wp-content' in href:
                    stylesheets.append(href)
    except:
        # Fallback: используем стандартные стили темы
        stylesheets = [
            "https://cs88500-wordpress-o0a99.tw1.ru/wp-content/themes/twentytwentyfive/style.css",
            "https://cs88500-wordpress-o0a99.tw1.ru/wp-content/themes/twentytwentyfive/assets/css/print.css",
            "https://cs88500-wordpress-o0a99.tw1.ru/wp-includes/css/dist/block-library/style.min.css"
        ]

    # Строим HTML-ответ
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{title}</title>
        <style>
            body {{
                margin: 0;
                padding: 20px;
                background: #fff;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            }}
            .wp-container {{
                max-width: 800px;
                margin: 0 auto;
            }}
        </style>
        {"".join([f'<link rel="stylesheet" href="{url}">' for url in stylesheets])}
    </head>
    <body>
        <div class="wp-container">
            {content}
        </div>
    </body>
    </html>
    """

    return HttpResponse(html)