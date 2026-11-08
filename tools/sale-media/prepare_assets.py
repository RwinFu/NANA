"""Prepare the sale edition's own media. Never reads the personal public/ directory.
Requires Pillow; the motion portrait additionally uses imageio-ffmpeg's bundled ffmpeg.
Run: python tools/sale-media/prepare_assets.py
The ten AI-generated source JPEGs are already in sale-public/sale/memories.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageEnhance
import subprocess
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[2]
MEDIA = ROOT / 'sale-public/sale/memories'
CATS = ROOT / 'sale-public/sale/cats'
CATS.mkdir(parents=True, exist_ok=True)

# crops are (left, top, right, bottom) in source pixels; all sources are synthetic.
CROPS = {
 'memory-06.jpg': ('memory-01.jpg', (270, 650, 680, 1110), 'warm'),
 'memory-07.jpg': ('memory-02.jpg', (140, 330, 660, 850), 'plain'),
 'memory-08.jpg': ('memory-03.jpg', (230, 700, 650, 1080), 'warm'),
 'memory-09.jpg': ('memory-04.jpg', (245, 610, 555, 1000), 'plain'),
 'memory-10.jpg': ('memory-05.jpg', (75, 740, 650, 1190), 'plain'),
 'memory-11.jpg': ('memory-01.jpg', (330, 690, 650, 1050), 'plain'),
 'memory-12.jpg': ('memory-02.jpg', (90, 300, 700, 1100), 'mono'),
 'memory-13.jpg': ('memory-03.jpg', (150, 360, 760, 880), 'warm'),
 'memory-14.jpg': ('memory-04.jpg', (110, 300, 700, 850), 'plain'),
 'memory-15.jpg': ('memory-05.jpg', (90, 330, 710, 850), 'plain'),
 'memory-16.jpg': ('memory-04.jpg', (30, 170, 738, 1170), 'warm'),
 'memory-17.jpg': ('memory-03.jpg', (320, 770, 540, 990), 'plain'),
 'memory-18.jpg': ('memory-04.jpg', (270, 650, 500, 940), 'mono'),
 'solo-06.jpg': ('solo-01.jpg', (265, 625, 680, 1040), 'plain'),
 'solo-07.jpg': ('solo-02.jpg', (130, 900, 650, 1290), 'plain'),
 'solo-08.jpg': ('solo-03.jpg', (440, 410, 735, 730), 'plain'),
 'solo-09.jpg': ('solo-05.jpg', (170, 230, 650, 830), 'plain'),
}

def save_crop(source, box, target, style='plain', max_size=1100):
    im = ImageOps.exif_transpose(Image.open(MEDIA / source)).convert('RGB').crop(box)
    if style == 'mono':
        im = ImageOps.grayscale(im).convert('RGB')
        im = ImageEnhance.Contrast(im).enhance(1.06)
    elif style == 'warm':
        r,g,b = im.split()
        r = r.point(lambda x: min(255, int(x*1.035)))
        b = b.point(lambda x: int(x*0.97))
        im = Image.merge('RGB', (r,g,b))
    im.thumbnail((max_size,max_size), Image.Resampling.LANCZOS)
    im.save(target, 'JPEG', quality=88, optimize=True)

for name, (source, box, style) in CROPS.items():
    save_crop(source, box, MEDIA / name, style)
save_crop('solo-02.jpg', (155, 925, 470, 1200), CATS / 'misha.jpg', max_size=400)
save_crop('solo-03.jpg', (475, 435, 700, 650), CATS / 'fandogh.jpg', max_size=400)
save_crop('solo-01.jpg', (100, 170, 775, 1170), MEDIA / 'motion-portrait-poster.jpg', max_size=600)

try:
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    ffmpeg = shutil.which('ffmpeg')
if ffmpeg:
    # A 9-second silent motion portrait, built only from the synthetic tea/lavender/jasmine images.
    # Gentle push-in and dissolves; no personal video or audio is read.
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        inputs = ['solo-01.jpg','solo-04.jpg','solo-05.jpg']
        filters=[]
        for i, name in enumerate(inputs):
            ImageOps.fit(Image.open(MEDIA/name).convert('RGB'), (720,1280), method=Image.Resampling.LANCZOS).save(tmp/f'{i}.jpg',quality=94)
            filters.append(f"[{i}:v]zoompan=z='1+0.00065*on':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=100:s=720x1280:fps=25,setsar=1,format=yuv420p[v{i}]")
        filters.append('[v0][v1]xfade=transition=fade:duration=0.8:offset=3.2[a]')
        filters.append('[a][v2]xfade=transition=fade:duration=0.8:offset=6.4,format=yuv420p[out]')
        cmd=[ffmpeg,'-y']
        for i in range(3): cmd += ['-loop','1','-framerate','25','-i',str(tmp/f'{i}.jpg')]
        cmd += ['-filter_complex',';'.join(filters),'-map','[out]','-an','-t','10.4','-c:v','libx264','-profile:v','main','-level','3.1','-pix_fmt','yuv420p','-crf','27','-maxrate','900k','-bufsize','1800k','-preset','medium','-g','25','-movflags','+faststart',str(MEDIA/'motion-portrait.mp4')]
        subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    print('Prepared 27 gallery images, 2 cat portraits and a silent motion portrait.')
else:
    print('Prepared still images. Install imageio-ffmpeg to regenerate the motion portrait.')
