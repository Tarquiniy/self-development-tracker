# backend/blog/utils.py
import re
from django.utils.text import slugify as dj_slugify

CYRILLIC_TO_LATIN = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
    'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
    'у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'',
    'э':'e','ю':'yu','я':'ya'
}

def translit_to_latin(text: str) -> str:
    result = []
    for ch in text:
        low = ch.lower()
        if low in CYRILLIC_TO_LATIN:
            mapped = CYRILLIC_TO_LATIN[low]
            # preserve case if capital
            if ch.isupper():
                mapped = mapped.capitalize()
            result.append(mapped)
        else:
            result.append(ch)
    return ''.join(result)

def translit_slugify(value: str, allow_unicode=False) -> str:
    if not value:
        return ''
    # first transliterate cyrillic -> latin
    t = translit_to_latin(value)
    # then use django slugify to remove unwanted chars and lower
    slug = dj_slugify(t, allow_unicode=allow_unicode)
    # ensure ascii-only, replace multiple hyphens
    slug = re.sub(r'-{2,}', '-', slug).strip('-')
    return slug[:200]
