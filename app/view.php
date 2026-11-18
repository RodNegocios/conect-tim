<?php
function assetUrl(string $filename): string {
    $version = hash_file('sha256', PUBLIC_ROOT . '/assets/' . $filename);
    return '/assets/' . $filename . '?v=' . substr($version, 0, 16);
}

function icon(string $name): string {
    $paths = ['bag'=>'M6 7h12l2 14H4L6 7Zm3 0V5a3 3 0 0 1 6 0v2','search'=>'m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0','arrow'=>'M4 12h16m-6-6 6 6-6 6','close'=>'m6 6 12 12M6 18 18 6','plus'=>'M12 5v14M5 12h14','pin'=>'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0','chat'=>'M21 11a9 9 0 0 1-9 9H4l-3 3 2-7A9 9 0 1 1 21 11ZM7 9h10M7 13h6','bolt'=>'m13 2-9 12h7l-1 8 10-13h-8l1-7Z','tool'=>'m14 6 4 4 4-4a7 7 0 0 1-9 9l-7 7-4-4 7-7a7 7 0 0 1 9-9l-4 4Z','cube'=>'m12 2 10 5v10l-10 5-10-5V7l10-5ZM2 7l10 5 10-5M12 12v10','phone'=>'M7 2h10v20H7zM10 18h4','check'=>'m4 12 5 5L20 6'];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'.($paths[$name] ?? $paths['arrow']).'"/></svg>';
}
