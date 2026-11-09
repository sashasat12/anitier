package com.anitier.phone;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/* Отдаёт файлы из cache/exports другим приложениям: так резервная копия
   уходит в Google Drive или мессенджер без доступа к внутренней памяти. */
public class ExportProvider extends ContentProvider {
    public static final String AUTHORITY = "com.anitier.phone.exports";

    private File fileFor(Uri uri) {
        String name = uri.getLastPathSegment();
        if (name == null || name.isEmpty() || name.contains("/") || name.contains("..")) return null;
        return new File(new File(getContext().getCacheDir(), "exports"), name);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = fileFor(uri);
        if (file == null || !file.exists()) throw new FileNotFoundException(String.valueOf(uri));
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        File file = fileFor(uri);
        if (file == null || !file.exists()) return null;
        String[] columns = projection != null
                ? projection
                : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns);
        Object[] row = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i] = file.getName();
            else if (OpenableColumns.SIZE.equals(columns[i])) row[i] = file.length();
            else row[i] = null;
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "application/json";
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
