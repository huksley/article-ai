#!/bin/bash
N="16 32 64 128 256"
rm *.png
for S in $N; do
    echo "Convert to ${S}x${S}"
    convert -background none icon.svg icon-${S}x${S}.png
done
