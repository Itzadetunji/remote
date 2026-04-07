//
//  AppFont.swift
//  Clip-It
//
//  Created by Adetunji Adeyinka on 7/04/2026.
//

import SwiftUI

/// Sofia Pro font variants for use across the app.
/// Use these instead of raw font names to ensure consistency.
struct SofiaFont {
    private init() {}

    // MARK: - Regular
    static func regular(size: CGFloat) -> Font {
        .custom("SofiaPro", size: size)
    }

    static func regularItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-Italic", size: size)
    }

    // MARK: - Light
    static func light(size: CGFloat) -> Font {
        .custom("SofiaPro-Light", size: size)
    }

    static func lightItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-LightItalic", size: size)
    }

    // MARK: - Extra Light
    static func extraLight(size: CGFloat) -> Font {
        .custom("SofiaPro-ExtraLight", size: size)
    }

    static func extraLightItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-ExtraLightItalic", size: size)
    }

    // MARK: - Ultra Light
    static func ultraLight(size: CGFloat) -> Font {
        .custom("SofiaPro-UltraLight", size: size)
    }

    static func ultraLightItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-UltraLightItalic", size: size)
    }

    // MARK: - Medium
    static func medium(size: CGFloat) -> Font {
        .custom("SofiaPro-Medium", size: size)
    }

    static func mediumItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-MediumItalic", size: size)
    }

    // MARK: - Semi Bold
    static func semiBold(size: CGFloat) -> Font {
        .custom("SofiaPro-SemiBold", size: size)
    }

    static func semiBoldItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-SemiBoldItalic", size: size)
    }

    // MARK: - Bold
    static func bold(size: CGFloat) -> Font {
        .custom("SofiaPro-Bold", size: size)
    }

    static func boldItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-BoldItalic", size: size)
    }

    // MARK: - Black
    static func black(size: CGFloat) -> Font {
        .custom("SofiaPro-Black", size: size)
    }

    static func blackItalic(size: CGFloat) -> Font {
        .custom("SofiaPro-BlackItalic", size: size)
    }
}
