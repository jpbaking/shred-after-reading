#!/usr/bin/env python3
import struct

def create_ico(filename):
    # BMP pixel data (1 pixel, 1 bit, padded to 4 bytes)
    bmp_data = b'\x00\x00\x00\x00'

    # BMP file header (14 bytes)
    bmp_header = b'BM'
    bmp_header += struct.pack('<I', 19)  # file size
    bmp_header += struct.pack('<HH', 0, 0)  # reserved
    bmp_header += struct.pack('<I', 14)  # data offset

    # BMP info header (40 bytes)
    bmp_info = struct.pack('<I', 1)  # width
    bmp_info += struct.pack('<I', 1)  # height
    bmp_info += struct.pack('<H', 1)  # planes
    bmp_info += struct.pack('<H', 1)  # bits per pixel
    bmp_info += struct.pack('<I', 0)  # compression
    bmp_info += struct.pack('<I', 4)  # image size
    bmp_info += struct.pack('<I', 2835)  # X pixels per meter
    bmp_info += struct.pack('<I', 2835)  # Y pixels per meter
    bmp_info += struct.pack('<I', 0)  # colors in palette
    bmp_info += struct.pack('<I', 0)  # important colors

    # BMP pixel data
    bmp_file = bmp_header + bmp_info + bmp_data

    # ICO image entry
    ico_image_size = len(bmp_file)
    ico_image_offset = 6 + 4 * 4

    # ICO header (2 bytes reserved, 1 byte type, 1 byte count, 2 bytes reserved)
    ico_header = struct.pack('<HHHH', 0, 1, 1, 0)

    # ICO image entry
    ico_image_entry = struct.pack('<IIHHIIii',
        1, 1,
        0, 0,
        1, 1,
        ico_image_size,
        ico_image_offset
    )

    with open(filename, 'wb') as f:
        f.write(ico_header + ico_image_entry + bmp_file)

create_ico('apps/web/public/favicon.ico')
print('Created favicon.ico')