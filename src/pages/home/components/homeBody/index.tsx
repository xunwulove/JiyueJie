import React from "react";
import globalStyle from "@/constants/globalStyle";
import StatsRow from "./statsRow";
import Operations from "./operations";
import RecommendSection from "./recommendSection";
import Sheets from "./sheets";
import { ScrollView } from "react-native-gesture-handler";

export default function HomeBody() {
    return (
        <ScrollView
            style={globalStyle.fwflex1}
            showsVerticalScrollIndicator={false}>
            <StatsRow />
            <Operations />
            <RecommendSection />
            <Sheets />
        </ScrollView>
    );
}
