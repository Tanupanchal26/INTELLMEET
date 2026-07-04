"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const Message = require('../../models/Message');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');
exports.getMessages = asyncHandler(async (req, res) => {
    const messages = await Message.find({ meeting: req.params.meetingId })
        .populate('sender', 'name avatar')
        .sort({ createdAt: 1 });
    ApiResponse.ok(res, messages);
});
exports.sendMessage = asyncHandler(async (req, res) => {
    const message = await Message.create({
        tenantId: req.tenantId,
        meeting: req.params.meetingId,
        sender: req.user._id,
        content: req.body.content,
        type: 'text',
    });
    const populated = await message.populate('sender', 'name avatar');
    ApiResponse.created(res, populated, 'Message sent');
});
exports.deleteMessage = asyncHandler(async (req, res) => {
    const msg = await Message.findOneAndUpdate({ _id: req.params.messageId, sender: req.user._id }, { isDeleted: true, content: '[Message deleted]', deletedAt: new Date() }, { new: true });
    if (!msg) {
        return res.status(404).json({ success: false, message: 'Message not found or not yours' });
    }
    ApiResponse.ok(res, { messageId: req.params.messageId }, 'Message deleted');
});
