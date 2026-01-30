import { google } from 'googleapis';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';

// Multi-tenant support via SecretVault (Session 249.2)
const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    const vaultPath = path.join(process.cwd(), '..', 'core', 'SecretVault.cjs');
    SecretVault = require(vaultPath);
} catch (e) {
    // Fallback to env vars
}

/**
 * Get Google credentials for a tenant
 * @param tenantId - Tenant ID (default: agency_internal)
 */
async function getGoogleCredentials(tenantId: string = 'agency_internal') {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.GOOGLE_CLIENT_ID && creds.GOOGLE_CLIENT_SECRET && creds.GOOGLE_REFRESH_TOKEN) {
            return {
                clientId: creds.GOOGLE_CLIENT_ID,
                clientSecret: creds.GOOGLE_CLIENT_SECRET,
                refreshToken: creds.GOOGLE_REFRESH_TOKEN,
                redirectUri: creds.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
            };
        }
    }
    // Fallback to environment
    return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    };
}

// Helper to get authenticated Drive client (multi-tenant aware)
async function getDriveClient(tenantId: string = 'agency_internal') {
    const creds = await getGoogleCredentials(tenantId);

    if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
        throw new Error("Missing Google Credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)");
    }

    const oAuth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
    oAuth2Client.setCredentials({ refresh_token: creds.refreshToken });
    return google.drive({ version: 'v3', auth: oAuth2Client });
}

export const driveTools = {
    list_files: {
        name: 'drive_list_files',
        description: 'List files in Google Drive (with optional query filter)',
        parameters: {
            query: z.string().optional().describe('Search query (e.g., "name contains \'report\'", "mimeType=\'application/pdf\'")'),
            folderId: z.string().optional().describe('Folder ID to list files from (default: root)'),
            pageSize: z.number().optional().describe('Number of files to return (default: 20, max: 100)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ query, folderId, pageSize = 20, _meta }: { query?: string, folderId?: string, pageSize?: number, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const drive = await getDriveClient(tenantId);

                // Build query
                let q = query || '';
                if (folderId) {
                    q = q ? `${q} and '${folderId}' in parents` : `'${folderId}' in parents`;
                }
                if (!q) {
                    q = "'root' in parents"; // Default to root
                }
                q += " and trashed = false";

                const response = await drive.files.list({
                    q,
                    pageSize: Math.min(pageSize, 100),
                    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents)',
                    orderBy: 'modifiedTime desc'
                });

                const files = response.data.files?.map(f => ({
                    id: f.id,
                    name: f.name,
                    mimeType: f.mimeType,
                    size: f.size ? parseInt(f.size) : null,
                    createdTime: f.createdTime,
                    modifiedTime: f.modifiedTime,
                    webViewLink: f.webViewLink
                })) || [];

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            query: q,
                            fileCount: files.length,
                            files
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are set. Scope: drive.file or drive.readonly"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    get_file: {
        name: 'drive_get_file',
        description: 'Get metadata for a specific file in Google Drive',
        parameters: {
            fileId: z.string().describe('The ID of the file'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ fileId, _meta }: { fileId: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const drive = await getDriveClient(tenantId);
                const response = await drive.files.get({
                    fileId,
                    fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, parents, owners, description'
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            file: {
                                id: response.data.id,
                                name: response.data.name,
                                mimeType: response.data.mimeType,
                                size: response.data.size,
                                createdTime: response.data.createdTime,
                                modifiedTime: response.data.modifiedTime,
                                webViewLink: response.data.webViewLink,
                                webContentLink: response.data.webContentLink,
                                description: response.data.description,
                                owners: response.data.owners?.map(o => o.emailAddress)
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "File may not exist or you don't have access"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    create_folder: {
        name: 'drive_create_folder',
        description: 'Create a new folder in Google Drive',
        parameters: {
            name: z.string().describe('Name of the folder to create'),
            parentId: z.string().optional().describe('Parent folder ID (default: root)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ name, parentId, _meta }: { name: string, parentId?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const drive = await getDriveClient(tenantId);
                const response = await drive.files.create({
                    requestBody: {
                        name,
                        mimeType: 'application/vnd.google-apps.folder',
                        parents: parentId ? [parentId] : undefined
                    },
                    fields: 'id, name, webViewLink'
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            folder: {
                                id: response.data.id,
                                name: response.data.name,
                                webViewLink: response.data.webViewLink
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "Ensure Google OAuth has 'drive.file' scope (not just readonly)"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    upload_file: {
        name: 'drive_upload_file',
        description: 'Upload a file to Google Drive from local path',
        parameters: {
            localPath: z.string().describe('Local file path to upload'),
            name: z.string().optional().describe('Name for the file in Drive (default: original filename)'),
            folderId: z.string().optional().describe('Folder ID to upload to (default: root)'),
            mimeType: z.string().optional().describe('MIME type of the file'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ localPath, name, folderId, mimeType, _meta }: { localPath: string, name?: string, folderId?: string, mimeType?: string, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                if (!fs.existsSync(localPath)) {
                    throw new Error(`File not found: ${localPath}`);
                }

                const drive = await getDriveClient(tenantId);
                const fileName = name || path.basename(localPath);

                const response = await drive.files.create({
                    requestBody: {
                        name: fileName,
                        parents: folderId ? [folderId] : undefined
                    },
                    media: {
                        mimeType: mimeType || 'application/octet-stream',
                        body: fs.createReadStream(localPath)
                    },
                    fields: 'id, name, mimeType, size, webViewLink'
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            file: {
                                id: response.data.id,
                                name: response.data.name,
                                mimeType: response.data.mimeType,
                                size: response.data.size,
                                webViewLink: response.data.webViewLink
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "Ensure file exists locally and Google OAuth has 'drive.file' scope"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    share_file: {
        name: 'drive_share_file',
        description: 'Share a file or folder with a user or make it public',
        parameters: {
            fileId: z.string().describe('The ID of the file or folder to share'),
            email: z.string().optional().describe('Email address to share with (for user/group sharing)'),
            role: z.enum(['reader', 'writer', 'commenter']).optional().describe('Permission role (default: reader)'),
            type: z.enum(['user', 'group', 'domain', 'anyone']).optional().describe('Share type (default: user, use "anyone" for public link)'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ fileId, email, role = 'reader', type = 'user', _meta }: { fileId: string, email?: string, role?: 'reader' | 'writer' | 'commenter', type?: 'user' | 'group' | 'domain' | 'anyone', _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const drive = await getDriveClient(tenantId);

                const permission: any = {
                    type,
                    role
                };

                if (type === 'user' || type === 'group') {
                    if (!email) {
                        throw new Error('Email required for user/group sharing');
                    }
                    permission.emailAddress = email;
                }

                const response = await drive.permissions.create({
                    fileId,
                    requestBody: permission,
                    fields: 'id, type, role, emailAddress'
                });

                // Get the shareable link
                const file = await drive.files.get({
                    fileId,
                    fields: 'webViewLink'
                });

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            permission: {
                                id: response.data.id,
                                type: response.data.type,
                                role: response.data.role,
                                emailAddress: response.data.emailAddress
                            },
                            shareableLink: file.data.webViewLink
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "Ensure Google OAuth has 'drive.file' scope"
                        }, null, 2)
                    }]
                };
            }
        }
    },

    delete_file: {
        name: 'drive_delete_file',
        description: 'Delete a file or folder (moves to trash)',
        parameters: {
            fileId: z.string().describe('The ID of the file or folder to delete'),
            permanent: z.boolean().optional().describe('Permanently delete (skip trash) - use with caution'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ fileId, permanent = false, _meta }: { fileId: string, permanent?: boolean, _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            try {
                const drive = await getDriveClient(tenantId);

                if (permanent) {
                    await drive.files.delete({ fileId });
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "success",
                                action: "permanently_deleted",
                                fileId
                            }, null, 2)
                        }]
                    };
                } else {
                    await drive.files.update({
                        fileId,
                        requestBody: { trashed: true }
                    });
                    return {
                        content: [{
                            type: "text" as const,
                            text: JSON.stringify({
                                status: "success",
                                action: "moved_to_trash",
                                fileId
                            }, null, 2)
                        }]
                    };
                }
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            hint: "File may not exist or you don't have permission to delete"
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
